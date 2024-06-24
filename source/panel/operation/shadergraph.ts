import { ShaderPropery, ShaderNode, ShaderEdge, resetGlobalShaderSlotID, ShaderSlot } from "./base";
import { getJsonObject } from "./utils";
import { createNode } from "./nodes";
import MasterNode from "./nodes/master/MasterNode";
import UnlitMasterNode from "./nodes/master/UnlitMasterNode"
import SubGraphNode from "./nodes/subgraph/SubGraphNode";

import fs, { unlink } from 'fs'
import PropertyNode from "./nodes/input/PropertyNode";
import PBRMasterNode from "./nodes/master/PBRMasterNode";

export default class ShaderGraph {
    static subgraphPath = ''

    static allNodes: ShaderNode[][] = [];

    static getOldNodeData(targetNode: any, rawNodeMap: Map<string, any>)
    {
        let convertedNode = JSON.parse(JSON.stringify(targetNode))
        let needsSlotGeneration = false
        if (!convertedNode.m_SerializableSlots)
        {
            convertedNode.m_SerializableSlots = Array<any>()
            needsSlotGeneration = true
        }
        convertedNode.m_PropertyGuidSerialized = ""
        convertedNode.typeInfo = { fullName: targetNode.m_Type }

        if (targetNode.m_Type === "UnityEditor.ShaderGraph.PropertyNode")
        {
            convertedNode.m_PropertyGuidSerialized = targetNode.m_Property.m_Id
        }

        if (convertedNode?.m_Guid?.m_GuidSerialized)
        {
            convertedNode.m_Guid.m_GuidSerialized = targetNode.m_ObjectId
        }

        let rawNode = rawNodeMap.get(targetNode.m_ObjectId)
        if (rawNode.m_Slots !== undefined && needsSlotGeneration)
        {
            for (let slot of rawNode.m_Slots)
            {
                let id = slot.m_Id
                let targetNode = rawNodeMap.get(id)

                let slotData = {
                    typeInfo: {
                        fullName: targetNode.m_Type,                       
                    },
                    JSONnodeData: JSON.stringify(targetNode)
                }
                convertedNode.m_SerializableSlots.push(slotData)    
            }
        }

        convertedNode.JSONnodeData = JSON.stringify(convertedNode)

        return convertedNode
    }

    static GetAllObjs(jsonStr: string)
    {
        const result = jsonStr.split(/\n\s*\n/);

        let jsonObjs: any[] = []
        for (let item of result)
        {
            if (item.length <= 0)
            {
                continue;
            }
            let content;
            try {
                content = JSON.parse(item);
            }
            catch (err) {
                console.error(err);
            }

            jsonObjs.push(content)
        }
        return jsonObjs
    }

    static GetNodeMapOfOldFormat(rawNodeMap: Map<string, any>)
    {
        let result: Map<string, any> = new Map
        rawNodeMap.forEach((value, key) => 
        {
            result.set(key, this.getOldNodeData(value, rawNodeMap))
        })

        return result
    }

    static searchNodesVersion3(jsonStr: string)
    {
        let jsonObjs: any[] = this.GetAllObjs(jsonStr)
        var mainGraphData: any = null;
        let rawNodeMap: Map<string, any> = new Map

        for (let content of jsonObjs)
        {
            if (content.m_Type === "UnityEditor.ShaderGraph.GraphData")
            {
                mainGraphData = content
            }

            rawNodeMap.set(content.m_ObjectId, content)
        }

        if (mainGraphData === null)
        {
            throw new Error("Unable to find main graph data!")
        }

        let nodeMap = this.GetNodeMapOfOldFormat(rawNodeMap)
        let properties: ShaderPropery[] = []
        let convertedNodes = [...nodeMap.values()]

        for (let item of mainGraphData.m_Properties)
        {
            let property = convertedNodes.find(node => node.m_ObjectId == item.m_Id)

            properties.push(new ShaderPropery(property));
        }
        
        let nodes: any[] = []

        let convertedNodeMap: Map<string, ShaderNode> = new Map
        convertedNodes.forEach(rawNode =>
            {
                let newNode = createNode(rawNode)
                if (newNode instanceof PropertyNode)
                {
                    newNode.searchProperties(properties)
                }
                nodes.push(newNode)
                convertedNodeMap.set(rawNode.m_ObjectId, newNode)
            }
        )

        mainGraphData.m_type = "UnityEditor.ShaderGraph.PBRMasterNode"
        mainGraphData.m_SerializableSlots = []
        let curID = 0
        for (let blockNode of rawNodeMap.values())
        {
            if (blockNode.m_Type !== "UnityEditor.ShaderGraph.BlockNode")
            {
                continue
            }
            if (blockNode.m_Slots === undefined)
            {
                continue;
            }
            for (let slot of blockNode.m_Slots)
            {
                let id = slot.m_Id
                let targetNode = rawNodeMap.get(id)
                targetNode.m_Id = curID++

                let slotData = { 
                    typeInfo: {
                        fullName: targetNode.m_Type,                       
                    },
                    JSONnodeData: JSON.stringify(targetNode)
                }
                mainGraphData.m_SerializableSlots.push(slotData)    
            }
        }

        let newMasterNode: MasterNode
        if (jsonStr.includes("UnityEditor.Rendering.BuiltIn.ShaderGraph.BuiltInUnlitSubTarget"))
        {
            newMasterNode = new UnlitMasterNode(this.getOldNodeData(mainGraphData, rawNodeMap))
            const colorNode = newMasterNode.slots.find(node => node.displayName === "Albedo")
            if (colorNode)
            {
                colorNode.displayName = "Color"
            }
        }
        else
        {
            newMasterNode = new PBRMasterNode(this.getOldNodeData(mainGraphData, rawNodeMap))
        }
        nodes.push(newMasterNode)

        let edges: ShaderEdge[] = mainGraphData.m_Edges.map(d => {
            let oldEdge = JSON.parse(JSON.stringify(d))
            
            let outputSlot = oldEdge.m_OutputSlot
            let inputSlot = oldEdge.m_InputSlot

            outputSlot.m_NodeGUIDSerialized = outputSlot.m_Node.m_Id
            inputSlot.m_NodeGUIDSerialized = inputSlot.m_Node.m_Id

            oldEdge.JSONnodeData = JSON.stringify(oldEdge)

            return new ShaderEdge(oldEdge)
        })

        let masterNodeSlotMapValues = [...newMasterNode.slotsMap.values()]
        for (let i = 0; i < edges.length; i++) {
            let edge = edges[i];
            let inputSlot = edge.input;
            let outputSlot = edge.output;

            let inputNode = convertedNodeMap.get(inputSlot.nodeUuid);
            let outputNode = convertedNodeMap.get(outputSlot.nodeUuid);

            if (outputNode instanceof SubGraphNode) {
                outputNode = outputNode.excahngeSubGraphOutNode(outputSlot);
            }

            if (!inputNode) {
                console.warn(`Can not find input [${inputSlot.nodeUuid}] for edge.`)
                continue;
            }
            if (!outputNode) {
                console.warn(`Can not find input [${outputSlot.nodeUuid}] for edge.`)
                continue;
            }

            let inputNodeType = (inputNode.type as any)?.fullName
            let isBlockNode = inputNodeType === "UnityEditor.ShaderGraph.BlockNode"
            if (isBlockNode)
            {
                newMasterNode.addDependency(outputNode)
            }
            else
            {
                inputNode.addDependency(outputNode);
            }
            outputNode.setPriority(inputNode.priority + 1);

            let inputNodeSlot: ShaderSlot | undefined
            if (isBlockNode)
            {
                inputNodeSlot = masterNodeSlotMapValues.find(slot =>
                    {
                        let inputNodeName = inputNode!.data.m_Name.replace("SurfaceDescription.", "")
                        const translatedName = ShaderSlot.DISPLAY_NAME_DICT.get(inputNodeName)
                        if (translatedName)
                        {
                            inputNodeName = translatedName
                        }
                        if (newMasterNode instanceof UnlitMasterNode && inputNodeName === "Albedo")
                        {
                            inputNodeName = "Color"
                        }
                        return slot.displayName === inputNodeName
                    }
                )
                if (!inputNodeSlot)
                {
                    throw new Error(`There is a connection to a block node named ${inputNode!.data.m_Name}, but the slot cannot be found in masternode!`)
                }
            }
            if (!isBlockNode || !inputNodeSlot)
            {
                inputNodeSlot = inputNode.slotsMap.get(inputSlot.id);
            }
            let outputNodeSlot = outputNode.slotsMap.get(outputSlot.id);

            if (inputNodeSlot && outputNodeSlot) {
                inputNodeSlot.connectSlots.push(outputNodeSlot);
                outputNodeSlot.connectSlots.push(inputNodeSlot);
            }
        }

        ShaderGraph.allNodes.push(nodes)
        
        return {
            properties,
            nodeMap,
            nodes,
            edges
        }       
    }

    static searchNodes (graphPath: string) {
        let contentStr = fs.readFileSync(graphPath, 'utf-8')

        if (contentStr.includes("m_SGVersion"))
        {
            return this.searchNodesVersion3(contentStr);
        }
        let content = getJsonObject(contentStr);
        if (!content) return;

        let properties: ShaderPropery[] = content.m_SerializedProperties.map(d => new ShaderPropery(d));
        let nodeMap: Map<string, ShaderNode> = new Map;

        let propertyNodeMap: Map<ShaderPropery, PropertyNode> = new Map;

        let nodes: ShaderNode[] = content.m_SerializableNodes.map(d => {
            let node = createNode(d);

            if (node instanceof PropertyNode) {
                node.searchProperties(properties);
                
                let propertyNode = propertyNodeMap.get(node.property!);
                if (propertyNode) {
                    nodeMap.set(node.uuid, propertyNode);
                    return propertyNode;
                }

                propertyNodeMap.set(node.property!, node);

            }

            nodeMap.set(node.uuid, node);
            return node;
        });

        let edges: ShaderEdge[] = content.m_SerializableEdges.map(d => {
            return new ShaderEdge(d)
        })

        for (let i = 0; i < edges.length; i++) {
            let edge = edges[i];
            let inputSlot = edge.input;
            let outputSlot = edge.output;

            let inputNode = nodeMap.get(inputSlot.nodeUuid);
            let outputNode = nodeMap.get(outputSlot.nodeUuid);

            if (outputNode instanceof SubGraphNode) {
                outputNode = outputNode.excahngeSubGraphOutNode(outputSlot);
            }

            if (!inputNode) {
                console.warn(`Can not find input [${inputSlot.nodeUuid}] for edge.`)
                continue;
            }
            if (!outputNode) {
                console.warn(`Can not find input [${outputSlot.nodeUuid}] for edge.`)
                continue;
            }

            inputNode.addDependency(outputNode);
            outputNode.setPriority(inputNode.priority + 1);

            let inputNodeSlot = inputNode.slotsMap.get(inputSlot.id);
            let outputNodeSlot = outputNode.slotsMap.get(outputSlot.id);

            if (inputNodeSlot && outputNodeSlot) {
                inputNodeSlot.connectSlots.push(outputNodeSlot);
                outputNodeSlot.connectSlots.push(inputNodeSlot);
            }
        }

        nodes.sort((a, b) => b.priority - a.priority);

        nodes.forEach(node => {
            if (node instanceof SubGraphNode) {
                node.exchangeSubGraphInputNodes();
            }

            node.calcConcretePrecision();
        })

        this.allNodes.push(nodes);

        return {
            properties,
            nodeMap,
            nodes,
            edges
        }
    }

    static decode (path: string) {
        
        resetGlobalShaderSlotID();

        this.allNodes.length = 0;

        let res = this.searchNodes(path);
        if (!res) {
            return;
        }

        let { properties, nodeMap, nodes, edges } = res;

        let masterNode = nodes.find(n => n instanceof MasterNode);
        if (!masterNode) {
            console.error('Can not find master node.');
            return;
        }

        (masterNode as MasterNode).properties = properties;

        this.allNodes.forEach(nodes => {
            nodes.forEach(node => {
                node.beforeGenreateCode()
            });
        })

        let code = masterNode.generateCode();
        return code;
    }
}
