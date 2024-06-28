"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const utils_1 = require("./utils");
const nodes_1 = require("./nodes");
const MasterNode_1 = __importDefault(require("./nodes/master/MasterNode"));
const UnlitMasterNode_1 = __importDefault(require("./nodes/master/UnlitMasterNode"));
const SubGraphNode_1 = __importDefault(require("./nodes/subgraph/SubGraphNode"));
const fs_1 = __importDefault(require("fs"));
const PropertyNode_1 = __importDefault(require("./nodes/input/PropertyNode"));
const PBRMasterNode_1 = __importDefault(require("./nodes/master/PBRMasterNode"));
class ShaderGraph {
    // Convert the data of new format back to the old one,
    // so there is no need to rewrite the core code of shader conversion.
    static getOldNodeData(targetNode, rawNodeMap) {
        var _a;
        let convertedNode = JSON.parse(JSON.stringify(targetNode));
        let needsSlotGeneration = false;
        // We must not override slots if there is already a non-null slots.
        if (!convertedNode.m_SerializableSlots) {
            convertedNode.m_SerializableSlots = Array();
            needsSlotGeneration = true;
        }
        convertedNode.m_PropertyGuidSerialized = "";
        convertedNode.typeInfo = { fullName: targetNode.m_Type };
        if (targetNode.m_Type === "UnityEditor.ShaderGraph.PropertyNode") {
            convertedNode.m_PropertyGuidSerialized = targetNode.m_Property.m_Id;
        }
        if ((_a = convertedNode === null || convertedNode === void 0 ? void 0 : convertedNode.m_Guid) === null || _a === void 0 ? void 0 : _a.m_GuidSerialized) {
            convertedNode.m_Guid.m_GuidSerialized = targetNode.m_ObjectId;
        }
        // The core shader conversion code reads the property "JSONnodeData",
        // which stores all information about this node,
        // for translation, so we need to serialize this node into this property.
        let rawNode = rawNodeMap.get(targetNode.m_ObjectId);
        if (rawNode.m_Slots !== undefined && needsSlotGeneration) {
            // The slot is the same as node, we need to store everything into "JSONnodeData".
            for (let slot of rawNode.m_Slots) {
                let id = slot.m_Id;
                let targetNode = rawNodeMap.get(id);
                let slotData = {
                    typeInfo: {
                        fullName: targetNode.m_Type,
                    },
                    JSONnodeData: JSON.stringify(targetNode)
                };
                convertedNode.m_SerializableSlots.push(slotData);
            }
        }
        convertedNode.JSONnodeData = JSON.stringify(convertedNode);
        return convertedNode;
    }
    // The new version of shader graph writes all JSONs into one file,
    // we need to split them.
    static GetAllObjs(jsonStr) {
        const result = jsonStr.split(/\n\s*\n/);
        let jsonObjs = [];
        for (let item of result) {
            if (item.length <= 0) {
                continue;
            }
            let content;
            try {
                content = JSON.parse(item);
            }
            catch (err) {
                console.error(err);
            }
            jsonObjs.push(content);
        }
        return jsonObjs;
    }
    static GetNodeMapOfOldFormat(rawNodeMap) {
        let result = new Map;
        rawNodeMap.forEach((value, key) => {
            result.set(key, this.getOldNodeData(value, rawNodeMap));
        });
        return result;
    }
    // If there is a m_Type "UnityEditor.ShaderGraph.GraphData" found in the shader graph file,
    // it is the new version of shader graph required to be translated.
    static searchNodesVersion3(jsonStr) {
        var _a;
        let jsonObjs = this.GetAllObjs(jsonStr);
        var mainGraphData = null;
        let rawNodeMap = new Map;
        for (let content of jsonObjs) {
            if (content.m_Type === "UnityEditor.ShaderGraph.GraphData") {
                mainGraphData = content;
            }
            rawNodeMap.set(content.m_ObjectId, content);
        }
        if (mainGraphData === null) {
            throw new Error("Unable to find main graph data!");
        }
        let nodeMap = this.GetNodeMapOfOldFormat(rawNodeMap);
        let properties = [];
        let convertedNodes = [...nodeMap.values()];
        for (let item of mainGraphData.m_Properties) {
            let property = convertedNodes.find(node => node.m_ObjectId == item.m_Id);
            properties.push(new base_1.ShaderPropery(property));
        }
        let nodes = [];
        let convertedNodeMap = new Map;
        convertedNodes.forEach(rawNode => {
            let newNode = nodes_1.createNode(rawNode);
            if (newNode instanceof PropertyNode_1.default) {
                newNode.searchProperties(properties);
            }
            nodes.push(newNode);
            convertedNodeMap.set(rawNode.m_ObjectId, newNode);
        });
        mainGraphData.m_type = "UnityEditor.ShaderGraph.PBRMasterNode";
        mainGraphData.m_SerializableSlots = [];
        // In old shader graph, all outputs are stored in the master node, however,
        // there are stored in block nodes in the new version.
        // We need to read all block nodes, then add those outputs back to the master node.
        let curID = 0;
        for (let blockNode of rawNodeMap.values()) {
            if (blockNode.m_Type !== "UnityEditor.ShaderGraph.BlockNode") {
                continue;
            }
            if (blockNode.m_Slots === undefined) {
                continue;
            }
            for (let slot of blockNode.m_Slots) {
                let id = slot.m_Id;
                let targetNode = rawNodeMap.get(id);
                targetNode.m_Id = curID++;
                let slotData = {
                    typeInfo: {
                        fullName: targetNode.m_Type,
                    },
                    JSONnodeData: JSON.stringify(targetNode)
                };
                mainGraphData.m_SerializableSlots.push(slotData);
            }
        }
        let newMasterNode;
        if (jsonStr.includes("UnityEditor.Rendering.BuiltIn.ShaderGraph.BuiltInUnlitSubTarget")) {
            newMasterNode = new UnlitMasterNode_1.default(this.getOldNodeData(mainGraphData, rawNodeMap));
            // Albedo is the base color used in PBR shader,
            // but it is called "Color" in unlit shader.
            const colorNode = newMasterNode.slots.find(node => node.displayName === "Albedo");
            if (colorNode) {
                colorNode.displayName = "Color";
            }
        }
        else {
            newMasterNode = new PBRMasterNode_1.default(this.getOldNodeData(mainGraphData, rawNodeMap));
        }
        nodes.push(newMasterNode);
        let edges = mainGraphData.m_Edges.map(d => {
            let oldEdge = JSON.parse(JSON.stringify(d));
            let outputSlot = oldEdge.m_OutputSlot;
            let inputSlot = oldEdge.m_InputSlot;
            outputSlot.m_NodeGUIDSerialized = outputSlot.m_Node.m_Id;
            inputSlot.m_NodeGUIDSerialized = inputSlot.m_Node.m_Id;
            oldEdge.JSONnodeData = JSON.stringify(oldEdge);
            return new base_1.ShaderEdge(oldEdge);
        });
        let masterNodeSlotMapValues = [...newMasterNode.slotsMap.values()];
        for (let i = 0; i < edges.length; i++) {
            let edge = edges[i];
            let inputSlot = edge.input;
            let outputSlot = edge.output;
            let inputNode = convertedNodeMap.get(inputSlot.nodeUuid);
            let outputNode = convertedNodeMap.get(outputSlot.nodeUuid);
            if (outputNode instanceof SubGraphNode_1.default) {
                outputNode = outputNode.excahngeSubGraphOutNode(outputSlot);
            }
            if (!inputNode) {
                console.warn(`Can not find input [${inputSlot.nodeUuid}] for edge.`);
                continue;
            }
            if (!outputNode) {
                console.warn(`Can not find input [${outputSlot.nodeUuid}] for edge.`);
                continue;
            }
            let inputNodeType = (_a = inputNode.type) === null || _a === void 0 ? void 0 : _a.fullName;
            // If the target of the output node is a block node, redirect the target to the master node.
            let isBlockNode = inputNodeType === "UnityEditor.ShaderGraph.BlockNode";
            if (isBlockNode) {
                newMasterNode.addDependency(outputNode);
            }
            else {
                inputNode.addDependency(outputNode);
            }
            outputNode.setPriority(inputNode.priority + 1);
            let inputNodeSlot;
            if (isBlockNode) {
                // Output redirection.
                inputNodeSlot = masterNodeSlotMapValues.find(slot => {
                    let inputNodeName = inputNode.data.m_Name.replace("SurfaceDescription.", "");
                    const translatedName = base_1.ShaderSlot.DISPLAY_NAME_DICT.get(inputNodeName);
                    if (translatedName) {
                        inputNodeName = translatedName;
                    }
                    // Just do the translation again...
                    if (newMasterNode instanceof UnlitMasterNode_1.default && inputNodeName === "Albedo") {
                        inputNodeName = "Color";
                    }
                    return slot.displayName === inputNodeName;
                });
                if (!inputNodeSlot) {
                    throw new Error(`There is a connection to a block node named ${inputNode.data.m_Name}, but the slot cannot be found in masternode!`);
                }
            }
            if (!isBlockNode || !inputNodeSlot) {
                inputNodeSlot = inputNode.slotsMap.get(inputSlot.id);
            }
            let outputNodeSlot = outputNode.slotsMap.get(outputSlot.id);
            if (inputNodeSlot && outputNodeSlot) {
                inputNodeSlot.connectSlots.push(outputNodeSlot);
                outputNodeSlot.connectSlots.push(inputNodeSlot);
            }
        }
        ShaderGraph.allNodes.push(nodes);
        return {
            properties,
            nodeMap,
            nodes,
            edges
        };
    }
    static searchNodes(graphPath) {
        let contentStr = fs_1.default.readFileSync(graphPath, 'utf-8');
        if (contentStr.includes("m_SGVersion")) {
            return this.searchNodesVersion3(contentStr);
        }
        let content = utils_1.getJsonObject(contentStr);
        if (!content)
            return;
        let properties = content.m_SerializedProperties.map(d => new base_1.ShaderPropery(d));
        let nodeMap = new Map;
        let propertyNodeMap = new Map;
        let nodes = content.m_SerializableNodes.map(d => {
            let node = nodes_1.createNode(d);
            if (node instanceof PropertyNode_1.default) {
                node.searchProperties(properties);
                let propertyNode = propertyNodeMap.get(node.property);
                if (propertyNode) {
                    nodeMap.set(node.uuid, propertyNode);
                    return propertyNode;
                }
                propertyNodeMap.set(node.property, node);
            }
            nodeMap.set(node.uuid, node);
            return node;
        });
        let edges = content.m_SerializableEdges.map(d => {
            return new base_1.ShaderEdge(d);
        });
        for (let i = 0; i < edges.length; i++) {
            let edge = edges[i];
            let inputSlot = edge.input;
            let outputSlot = edge.output;
            let inputNode = nodeMap.get(inputSlot.nodeUuid);
            let outputNode = nodeMap.get(outputSlot.nodeUuid);
            if (outputNode instanceof SubGraphNode_1.default) {
                outputNode = outputNode.excahngeSubGraphOutNode(outputSlot);
            }
            if (!inputNode) {
                console.warn(`Can not find input [${inputSlot.nodeUuid}] for edge.`);
                continue;
            }
            if (!outputNode) {
                console.warn(`Can not find input [${outputSlot.nodeUuid}] for edge.`);
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
            if (node instanceof SubGraphNode_1.default) {
                node.exchangeSubGraphInputNodes();
            }
            node.calcConcretePrecision();
        });
        this.allNodes.push(nodes);
        return {
            properties,
            nodeMap,
            nodes,
            edges
        };
    }
    static decode(path) {
        base_1.resetGlobalShaderSlotID();
        this.allNodes.length = 0;
        let res = this.searchNodes(path);
        if (!res) {
            return;
        }
        let { properties, nodeMap, nodes, edges } = res;
        let masterNode = nodes.find(n => n instanceof MasterNode_1.default);
        if (!masterNode) {
            console.error('Can not find master node.');
            return;
        }
        masterNode.properties = properties;
        this.allNodes.forEach(nodes => {
            nodes.forEach(node => {
                node.beforeGenreateCode();
            });
        });
        let code = masterNode.generateCode();
        return code;
    }
}
exports.default = ShaderGraph;
ShaderGraph.subgraphPath = '';
ShaderGraph.allNodes = [];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyZ3JhcGguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWwvb3BlcmF0aW9uL3NoYWRlcmdyYXBoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsaUNBQW9HO0FBQ3BHLG1DQUF3QztBQUN4QyxtQ0FBcUM7QUFDckMsMkVBQW1EO0FBQ25ELHFGQUE0RDtBQUM1RCxpRkFBeUQ7QUFFekQsNENBQStCO0FBQy9CLDhFQUFzRDtBQUN0RCxpRkFBeUQ7QUFFekQsTUFBcUIsV0FBVztJQUs1QixzREFBc0Q7SUFDdEQscUVBQXFFO0lBQ3JFLE1BQU0sQ0FBQyxjQUFjLENBQUMsVUFBZSxFQUFFLFVBQTRCOztRQUUvRCxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQTtRQUMxRCxJQUFJLG1CQUFtQixHQUFHLEtBQUssQ0FBQTtRQUMvQixtRUFBbUU7UUFDbkUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsRUFDdEM7WUFDSSxhQUFhLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxFQUFPLENBQUE7WUFDaEQsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO1NBQzdCO1FBQ0QsYUFBYSxDQUFDLHdCQUF3QixHQUFHLEVBQUUsQ0FBQTtRQUMzQyxhQUFhLENBQUMsUUFBUSxHQUFHLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQTtRQUV4RCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssc0NBQXNDLEVBQ2hFO1lBQ0ksYUFBYSxDQUFDLHdCQUF3QixHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFBO1NBQ3RFO1FBRUQsVUFBSSxhQUFhLGFBQWIsYUFBYSx1QkFBYixhQUFhLENBQUUsTUFBTSwwQ0FBRSxnQkFBZ0IsRUFDM0M7WUFDSSxhQUFhLENBQUMsTUFBTSxDQUFDLGdCQUFnQixHQUFHLFVB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T0FBTztTQUNWO1FBRUQsSUFBSSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxHQUFHLEdBQUcsQ0FBQztRQUVoRCxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLG9CQUFVLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBQzNDLE9BQU87U0FDVjtRQUVBLFVBQXlCLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUVuRCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUMxQixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNqQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQTtZQUM3QixDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFBO1FBRUYsSUFBSSxJQUFJLEdBQUcsVUFBVSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JDLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7O0FBelpMLDhCQTBaQztBQXpaVSx3QkFBWSxHQUFHLEVBQUUsQ0FBQTtBQUVqQixvQkFBUSxHQUFtQixFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTaGFkZXJQcm9wZXJ5LCBTaGFkZXJOb2RlLCBTaGFkZXJFZGdlLCByZXNldEdsb2JhbFNoYWRlclNsb3RJRCwgU2hhZGVyU2xvdCB9IGZyb20gXCIuL2Jhc2VcIjtcclxuaW1wb3J0IHsgZ2V0SnNvbk9iamVjdCB9IGZyb20gXCIuL3V0aWxzXCI7XHJcbmltcG9ydCB7IGNyZWF0ZU5vZGUgfSBmcm9tIFwiLi9ub2Rlc1wiO1xyXG5pbXBvcnQgTWFzdGVyTm9kZSBmcm9tIFwiLi9ub2Rlcy9tYXN0ZXIvTWFzdGVyTm9kZVwiO1xyXG5pbXBvcnQgVW5saXRNYXN0ZXJOb2RlIGZyb20gXCIuL25vZGVzL21hc3Rlci9VbmxpdE1hc3Rlck5vZGVcIlxyXG5pbXBvcnQgU3ViR3JhcGhOb2RlIGZyb20gXCIuL25vZGVzL3N1YmdyYXBoL1N1YkdyYXBoTm9kZVwiO1xyXG5cclxuaW1wb3J0IGZzLCB7IHVubGluayB9IGZyb20gJ2ZzJ1xyXG5pbXBvcnQgUHJvcGVydHlOb2RlIGZyb20gXCIuL25vZGVzL2lucHV0L1Byb3BlcnR5Tm9kZVwiO1xyXG5pbXBvcnQgUEJSTWFzdGVyTm9kZSBmcm9tIFwiLi9ub2Rlcy9tYXN0ZXIvUEJSTWFzdGVyTm9kZVwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU2hhZGVyR3JhcGgge1xyXG4gICAgc3RhdGljIHN1YmdyYXBoUGF0aCA9ICcnXHJcblxyXG4gICAgc3RhdGljIGFsbE5vZGVzOiBTaGFkZXJOb2RlW11bXSA9IFtdO1xyXG5cclxuICAgIC8vIENvbnZlcnQgdGhlIGRhdGEgb2YgbmV3IGZvcm1hdCBiYWNrIHRvIHRoZSBvbGQgb25lLFxyXG4gICAgLy8gc28gdGhlcmUgaXMgbm8gbmVlZCB0byByZXdyaXRlIHRoZSBjb3JlIGNvZGUgb2Ygc2hhZGVyIGNvbnZlcnNpb24uXHJcbiAgICBzdGF0aWMgZ2V0T2xkTm9kZURhdGEodGFyZ2V0Tm9kZTogYW55LCByYXdOb2RlTWFwOiBNYXA8c3RyaW5nLCBhbnk+KVxyXG4gICAge1xyXG4gICAgICAgIGxldCBjb252ZXJ0ZWROb2RlID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0YXJnZXROb2RlKSlcclxuICAgICAgICBsZXQgbmVlZHNTbG90R2VuZXJhdGlvbiA9IGZhbHNlXHJcbiAgICAgICAgLy8gV2UgbXVzdCBub3Qgb3ZlcnJpZGUgc2xvdHMgaWYgdGhlcmUgaXMgYWxyZWFkeSBhIG5vbi1udWxsIHNsb3RzLlxyXG4gICAgICAgIGlmICghY29udmVydGVkTm9kZS5tX1NlcmlhbGl6YWJsZVNsb3RzKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY29udmVydGVkTm9kZS5tX1NlcmlhbGl6YWJsZVNsb3RzID0gQXJyYXk8YW55PigpXHJcbiAgICAgICAgICAgIG5lZWRzU2xvdEdlbmVyYXRpb24gPSB0cnVlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnZlcnRlZE5vZGUubV9Qcm9wZXJ0eUd1aWRTZXJpYWxpemVkID0gXCJcIlxyXG4gICAgICAgIGNvbnZlcnRlZE5vZGUudHlwZUluZm8gPSB7IGZ1bGxOYW1lOiB0YXJnZXROb2RlLm1fVHlwZSB9XHJcblxyXG4gICAgICAgIGlmICh0YXJnZXROb2RlLm1fVHlwZSA9PT0gXCJVbml0eUVkaXRvci5TaGFkZXJHcmFwaC5Qcm9wZXJ0eU5vZGVcIilcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGNvbnZlcnRlZE5vZGUubV9Qcm9wZXJ0eUd1aWRTZXJpYWxpemVkID0gdGFyZ2V0Tm9kZS5tX1Byb3BlcnR5Lm1fSWRcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjb252ZXJ0ZWROb2RlPy5tX0d1aWQ/Lm1fR3VpZFNlcmlhbGl6ZWQpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjb252ZXJ0ZWROb2RlLm1fR3VpZC5tX0d1aWRTZXJpYWxpemVkID0gdGFyZ2V0Tm9kZS5tX09iamVjdElkXHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFRoZSBjb3JlIHNoYWRlciBjb252ZXJzaW9uIGNvZGUgcmVhZHMgdGhlIHByb3BlcnR5IFwiSlNPTm5vZGVEYXRhXCIsXHJcbiAgICAgICAgLy8gd2hpY2ggc3RvcmVzIGFsbCBpbmZvcm1hdGlvbiBhYm91dCB0aGlzIG5vZGUsXHJcbiAgICAgICAgLy8gZm9yIHRyYW5zbGF0aW9uLCBzbyB3ZSBuZWVkIHRvIHNlcmlhbGl6ZSB0aGlzIG5vZGUgaW50byB0aGlzIHByb3BlcnR5LlxyXG4gICAgICAgIGxldCByYXdOb2RlID0gcmF3Tm9kZU1hcC5nZXQodGFyZ2V0Tm9kZS5tX09iamVjdElkKVxyXG4gICAgICAgIGlmIChyYXdOb2RlLm1fU2xvdHMgIT09IHVuZGVmaW5lZCAmJiBuZWVkc1Nsb3RHZW5lcmF0aW9uKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgLy8gVGhlIHNsb3QgaXMgdGhlIHNhbWUgYXMgbm9kZSwgd2UgbmVlZCB0byBzdG9yZSBldmVyeXRoaW5nIGludG8gXCJKU09Obm9kZURhdGFcIi5cclxuICAgICAgICAgICAgZm9yIChsZXQgc2xvdCBvZiByYXdOb2RlLm1fU2xvdHMpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGxldCBpZCA9IHNsb3QubV9JZFxyXG4gICAgICAgICAgICAgICAgbGV0IHRhcmdldE5vZGUgPSByYXdOb2RlTWFwLmdldChpZClcclxuXHJcbiAgICAgICAgICAgICAgICBsZXQgc2xvdERhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZUluZm86IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnVsbE5hbWU6IHRhcmdldE5vZGUubV9UeXBlLCAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBKU09Obm9kZURhdGE6IEpTT04uc3RyaW5naWZ5KHRhcmdldE5vZGUpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb252ZXJ0ZWROb2RlLm1fU2VyaWFsaXphYmxlU2xvdHMucHVzaChzbG90RGF0YSkgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnZlcnRlZE5vZGUuSlNPTm5vZGVEYXRhID0gSlNPTi5zdHJpbmdpZnkoY29udmVydGVkTm9kZSlcclxuXHJcbiAgICAgICAgcmV0dXJuIGNvbnZlcnRlZE5vZGVcclxuICAgIH1cclxuXHJcbiAgICAvLyBUaGUgbmV3IHZlcnNpb24gb2Ygc2hhZGVyIGdyYXBoIHdyaXRlcyBhbGwgSlNPTnMgaW50byBvbmUgZmlsZSxcclxuICAgIC8vIHdlIG5lZWQgdG8gc3BsaXQgdGhlbS5cclxuICAgIHN0YXRpYyBHZXRBbGxPYmpzKGpzb25TdHI6IHN0cmluZylcclxuICAgIHtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBqc29uU3RyLnNwbGl0KC9cXG5cXHMqXFxuLyk7XHJcblxyXG4gICAgICAgIGxldCBqc29uT2JqczogYW55W10gPSBbXVxyXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgcmVzdWx0KVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaWYgKGl0ZW0ubGVuZ3RoIDw9IDApXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxldCBjb250ZW50O1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29udGVudCA9IEpTT04ucGFyc2UoaXRlbSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBqc29uT2Jqcy5wdXNoKGNvbnRlbnQpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBqc29uT2Jqc1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBHZXROb2RlTWFwT2ZPbGRGb3JtYXQocmF3Tm9kZU1hcDogTWFwPHN0cmluZywgYW55PilcclxuICAgIHtcclxuICAgICAgICBsZXQgcmVzdWx0OiBNYXA8c3RyaW5nLCBhbnk+ID0gbmV3IE1hcFxyXG4gICAgICAgIHJhd05vZGVNYXAuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICByZXN1bHQuc2V0KGtleSwgdGhpcy5nZXRPbGROb2RlRGF0YSh2YWx1ZSwgcmF3Tm9kZU1hcCkpXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdFxyXG4gICAgfVxyXG5cclxuICAgIC8vIElmIHRoZXJlIGlzIGEgbV9UeXBlIFwiVW5pdHlFZGl0b3IuU2hhZGVyR3JhcGguR3JhcGhEYXRhXCIgZm91bmQgaW4gdGhlIHNoYWRlciBncmFwaCBmaWxlLFxyXG4gICAgLy8gaXQgaXMgdGhlIG5ldyB2ZXJzaW9uIG9mIHNoYWRlciBncmFwaCByZXF1aXJlZCB0byBiZSB0cmFuc2xhdGVkLlxyXG4gICAgc3RhdGljIHNlYXJjaE5vZGVzVmVyc2lvbjMoanNvblN0cjogc3RyaW5nKVxyXG4gICAge1xyXG4gICAgICAgIGxldCBqc29uT2JqczogYW55W10gPSB0aGlzLkdldEFsbE9ianMoanNvblN0cilcclxuICAgICAgICB2YXIgbWFpbkdyYXBoRGF0YTogYW55ID0gbnVsbDtcclxuICAgICAgICBsZXQgcmF3Tm9kZU1hcDogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXBcclxuXHJcbiAgICAgICAgZm9yIChsZXQgY29udGVudCBvZiBqc29uT2JqcylcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGlmIChjb250ZW50Lm1fVHlwZSA9PT0gXCJVbml0eUVkaXRvci5TaGFkZXJHcmFwaC5HcmFwaERhdGFcIilcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbWFpbkdyYXBoRGF0YSA9IGNvbnRlbnRcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmF3Tm9kZU1hcC5zZXQoY29udGVudC5tX09iamVjdElkLCBjb250ZW50KVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKG1haW5HcmFwaERhdGEgPT09IG51bGwpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtYWluIGdyYXBoIGRhdGEhXCIpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgbm9kZU1hcCA9IHRoaXMuR2V0Tm9kZU1hcE9mT2xkRm9ybWF0KHJhd05vZGVNYXApXHJcbiAgICAgICAgbGV0IHByb3BlcnRpZXM6IFNoYWRlclByb3BlcnlbXSA9IFtdXHJcbiAgICAgICAgbGV0IGNvbnZlcnRlZE5vZGVzID0gWy4uLm5vZGVNYXAudmFsdWVzKCldXHJcblxyXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgbWFpbkdyYXBoRGF0YS5tX1Byb3BlcnRpZXMpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBsZXQgcHJvcGVydHkgPSBjb252ZXJ0ZWROb2Rlcy5maW5kKG5vZGUgPT4gbm9kZS5tX09iamVjdElkID09IGl0ZW0ubV9JZClcclxuXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXMucHVzaChuZXcgU2hhZGVyUHJvcGVyeShwcm9wZXJ0eSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsZXQgbm9kZXM6IGFueVtdID0gW11cclxuXHJcbiAgICAgICAgbGV0IGNvbnZlcnRlZE5vZGVNYXA6IE1hcDxzdHJpbmcsIFNoYWRlck5vZGU+ID0gbmV3IE1hcFxyXG4gICAgICAgIGNvbnZlcnRlZE5vZGVzLmZvckVhY2gocmF3Tm9kZSA9PlxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGNyZWF0ZU5vZGUocmF3Tm9kZSlcclxuICAgICAgICAgICAgICAgIGlmIChuZXdOb2RlIGluc3RhbmNlb2YgUHJvcGVydHlOb2RlKVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5ld05vZGUuc2VhcmNoUHJvcGVydGllcyhwcm9wZXJ0aWVzKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChuZXdOb2RlKVxyXG4gICAgICAgICAgICAgICAgY29udmVydGVkTm9kZU1hcC5zZXQocmF3Tm9kZS5tX09iamVjdElkLCBuZXdOb2RlKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKVxyXG5cclxuICAgICAgICBtYWluR3JhcGhEYXRhLm1fdHlwZSA9IFwiVW5pdHlFZGl0b3IuU2hhZGVyR3JhcGguUEJSTWFzdGVyTm9kZVwiXHJcbiAgICAgICAgbWFpbkdyYXBoRGF0YS5tX1NlcmlhbGl6YWJsZVNsb3RzID0gW11cclxuICAgICAgICAvLyBJbiBvbGQgc2hhZGVyIGdyYXBoLCBhbGwgb3V0cHV0cyBhcmUgc3RvcmVkIGluIHRoZSBtYXN0ZXIgbm9kZSwgaG93ZXZlcixcclxuICAgICAgICAvLyB0aGVyZSBhcmUgc3RvcmVkIGluIGJsb2NrIG5vZGVzIGluIHRoZSBuZXcgdmVyc2lvbi5cclxuICAgICAgICAvLyBXZSBuZWVkIHRvIHJlYWQgYWxsIGJsb2NrIG5vZGVzLCB0aGVuIGFkZCB0aG9zZSBvdXRwdXRzIGJhY2sgdG8gdGhlIG1hc3RlciBub2RlLlxyXG4gICAgICAgIGxldCBjdXJJRCA9IDBcclxuICAgICAgICBmb3IgKGxldCBibG9ja05vZGUgb2YgcmF3Tm9kZU1hcC52YWx1ZXMoKSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGlmIChibG9ja05vZGUubV9UeXBlICE9PSBcIlVuaXR5RWRpdG9yLlNoYWRlckdyYXBoLkJsb2NrTm9kZVwiKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChibG9ja05vZGUubV9TbG90cyA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKGxldCBzbG90IG9mIGJsb2NrTm9kZS5tX1Nsb3RzKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBsZXQgaWQgPSBzbG90Lm1fSWRcclxuICAgICAgICAgICAgICAgIGxldCB0YXJnZXROb2RlID0gcmF3Tm9kZU1hcC5nZXQoaWQpXHJcbiAgICAgICAgICAgICAgICB0YXJnZXROb2RlLm1fSWQgPSBjdXJJRCsrXHJcblxyXG4gICAgICAgICAgICAgICAgbGV0IHNsb3REYXRhID0geyBcclxuICAgICAgICAgICAgICAgICAgICB0eXBlSW5mbzoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmdWxsTmFtZTogdGFyZ2V0Tm9kZS5tX1R5cGUsICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIEpTT05ub2RlRGF0YTogSlNPTi5zdHJpbmdpZnkodGFyZ2V0Tm9kZSlcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIG1haW5HcmFwaERhdGEubV9TZXJpYWxpemFibGVTbG90cy5wdXNoKHNsb3REYXRhKSAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IG5ld01hc3Rlck5vZGU6IE1hc3Rlck5vZGVcclxuICAgICAgICBpZiAoanNvblN0ci5pbmNsdWRlcyhcIlVuaXR5RWRpdG9yLlJlbmRlcmluZy5CdWlsdEluLlNoYWRlckdyYXBoLkJ1aWx0SW5VbmxpdFN1YlRhcmdldFwiKSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIG5ld01hc3Rlck5vZGUgPSBuZXcgVW5saXRNYXN0ZXJOb2RlKHRoaXMuZ2V0T2xkTm9kZURhdGEobWFpbkdyYXBoRGF0YSwgcmF3Tm9kZU1hcCkpXHJcbiAgICAgICAgICAgIC8vIEFsYmVkbyBpcyB0aGUgYmFzZSBjb2xvciB1c2VkIGluIFBCUiBzaGFkZXIsXHJcbiAgICAgICAgICAgIC8vIGJ1dCBpdCBpcyBjYWxsZWQgXCJDb2xvclwiIGluIHVubGl0IHNoYWRlci5cclxuICAgICAgICAgICAgY29uc3QgY29sb3JOb2RlID0gbmV3TWFzdGVyTm9kZS5zbG90cy5maW5kKG5vZGUgPT4gbm9kZS5kaXNwbGF5TmFtZSA9PT0gXCJBbGJlZG9cIilcclxuICAgICAgICAgICAgaWYgKGNvbG9yTm9kZSlcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgY29sb3JOb2RlLmRpc3BsYXlOYW1lID0gXCJDb2xvclwiXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgbmV3TWFzdGVyTm9kZSA9IG5ldyBQQlJNYXN0ZXJOb2RlKHRoaXMuZ2V0T2xkTm9kZURhdGEobWFpbkdyYXBoRGF0YSwgcmF3Tm9kZU1hcCkpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5vZGVzLnB1c2gobmV3TWFzdGVyTm9kZSlcclxuXHJcbiAgICAgICAgbGV0IGVkZ2VzOiBTaGFkZXJFZGdlW10gPSBtYWluR3JhcGhEYXRhLm1fRWRnZXMubWFwKGQgPT4ge1xyXG4gICAgICAgICAgICBsZXQgb2xkRWRnZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZCkpXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsZXQgb3V0cHV0U2xvdCA9IG9sZEVkZ2UubV9PdXRwdXRTbG90XHJcbiAgICAgICAgICAgIGxldCBpbnB1dFNsb3QgPSBvbGRFZGdlLm1fSW5wdXRTbG90XHJcblxyXG4gICAgICAgICAgICBvdXRwdXRTbG90Lm1fTm9kZUdVSURTZXJpYWxpemVkID0gb3V0cHV0U2xvdC5tX05vZGUubV9JZFxyXG4gICAgICAgICAgICBpbnB1dFNsb3QubV9Ob2RlR1VJRFNlcmlhbGl6ZWQgPSBpbnB1dFNsb3QubV9Ob2RlLm1fSWRcclxuXHJcbiAgICAgICAgICAgIG9sZEVkZ2UuSlNPTm5vZGVEYXRhID0gSlNPTi5zdHJpbmdpZnkob2xkRWRnZSlcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgU2hhZGVyRWRnZShvbGRFZGdlKVxyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIGxldCBtYXN0ZXJOb2RlU2xvdE1hcFZhbHVlcyA9IFsuLi5uZXdNYXN0ZXJOb2RlLnNsb3RzTWFwLnZhbHVlcygpXVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZWRnZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGVkZ2UgPSBlZGdlc1tpXTtcclxuICAgICAgICAgICAgbGV0IGlucHV0U2xvdCA9IGVkZ2UuaW5wdXQ7XHJcbiAgICAgICAgICAgIGxldCBvdXRwdXRTbG90ID0gZWRnZS5vdXRwdXQ7XHJcblxyXG4gICAgICAgICAgICBsZXQgaW5wdXROb2RlID0gY29udmVydGVkTm9kZU1hcC5nZXQoaW5wdXRTbG90Lm5vZGVVdWlkKTtcclxuICAgICAgICAgICAgbGV0IG91dHB1dE5vZGUgPSBjb252ZXJ0ZWROb2RlTWFwLmdldChvdXRwdXRTbG90Lm5vZGVVdWlkKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChvdXRwdXROb2RlIGluc3RhbmNlb2YgU3ViR3JhcGhOb2RlKSB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXROb2RlID0gb3V0cHV0Tm9kZS5leGNhaG5nZVN1YkdyYXBoT3V0Tm9kZShvdXRwdXRTbG90KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFpbnB1dE5vZGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgQ2FuIG5vdCBmaW5kIGlucHV0IFske2lucHV0U2xvdC5ub2RlVXVpZH1dIGZvciBlZGdlLmApXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIW91dHB1dE5vZGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgQ2FuIG5vdCBmaW5kIGlucHV0IFske291dHB1dFNsb3Qubm9kZVV1aWR9XSBmb3IgZWRnZS5gKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBpbnB1dE5vZGVUeXBlID0gKGlucHV0Tm9kZS50eXBlIGFzIGFueSk/LmZ1bGxOYW1lXHJcbiAgICAgICAgICAgIC8vIElmIHRoZSB0YXJnZXQgb2YgdGhlIG91dHB1dCBub2RlIGlzIGEgYmxvY2sgbm9kZSwgcmVkaXJlY3QgdGhlIHRhcmdldCB0byB0aGUgbWFzdGVyIG5vZGUuXHJcbiAgICAgICAgICAgIGxldCBpc0Jsb2NrTm9kZSA9IGlucHV0Tm9kZVR5cGUgPT09IFwiVW5pdHlFZGl0b3IuU2hhZGVyR3JhcGguQmxvY2tOb2RlXCJcclxuICAgICAgICAgICAgaWYgKGlzQmxvY2tOb2RlKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuZXdNYXN0ZXJOb2RlLmFkZERlcGVuZGVuY3kob3V0cHV0Tm9kZSlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGlucHV0Tm9kZS5hZGREZXBlbmRlbmN5KG91dHB1dE5vZGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG91dHB1dE5vZGUuc2V0UHJpb3JpdHkoaW5wdXROb2RlLnByaW9yaXR5ICsgMSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgaW5wdXROb2RlU2xvdDogU2hhZGVyU2xvdCB8IHVuZGVmaW5lZFxyXG4gICAgICAgICAgICBpZiAoaXNCbG9ja05vZGUpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIC8vIE91dHB1dCByZWRpcmVjdGlvbi5cclxuICAgICAgICAgICAgICAgIGlucHV0Tm9kZVNsb3QgPSBtYXN0ZXJOb2RlU2xvdE1hcFZhbHVlcy5maW5kKHNsb3QgPT5cclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBpbnB1dE5vZGVOYW1lID0gaW5wdXROb2RlIS5kYXRhLm1fTmFtZS5yZXBsYWNlKFwiU3VyZmFjZURlc2NyaXB0aW9uLlwiLCBcIlwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0cmFuc2xhdGVkTmFtZSA9IFNoYWRlclNsb3QuRElTUExBWV9OQU1FX0RJQ1QuZ2V0KGlucHV0Tm9kZU5hbWUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0cmFuc2xhdGVkTmFtZSlcclxuICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXROb2RlTmFtZSA9IHRyYW5zbGF0ZWROYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSnVzdCBkbyB0aGUgdHJhbnNsYXRpb24gYWdhaW4uLi5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld01hc3Rlck5vZGUgaW5zdGFuY2VvZiBVbmxpdE1hc3Rlck5vZGUgJiYgaW5wdXROb2RlTmFtZSA9PT0gXCJBbGJlZG9cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXROb2RlTmFtZSA9IFwiQ29sb3JcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzbG90LmRpc3BsYXlOYW1lID09PSBpbnB1dE5vZGVOYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgaWYgKCFpbnB1dE5vZGVTbG90KVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlcmUgaXMgYSBjb25uZWN0aW9uIHRvIGEgYmxvY2sgbm9kZSBuYW1lZCAke2lucHV0Tm9kZSEuZGF0YS5tX05hbWV9LCBidXQgdGhlIHNsb3QgY2Fubm90IGJlIGZvdW5kIGluIG1hc3Rlcm5vZGUhYClcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWlzQmxvY2tOb2RlIHx8ICFpbnB1dE5vZGVTbG90KVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBpbnB1dE5vZGVTbG90ID0gaW5wdXROb2RlLnNsb3RzTWFwLmdldChpbnB1dFNsb3QuaWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxldCBvdXRwdXROb2RlU2xvdCA9IG91dHB1dE5vZGUuc2xvdHNNYXAuZ2V0KG91dHB1dFNsb3QuaWQpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGlucHV0Tm9kZVNsb3QgJiYgb3V0cHV0Tm9kZVNsb3QpIHtcclxuICAgICAgICAgICAgICAgIGlucHV0Tm9kZVNsb3QuY29ubmVjdFNsb3RzLnB1c2gob3V0cHV0Tm9kZVNsb3QpO1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0Tm9kZVNsb3QuY29ubmVjdFNsb3RzLnB1c2goaW5wdXROb2RlU2xvdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIFNoYWRlckdyYXBoLmFsbE5vZGVzLnB1c2gobm9kZXMpXHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgcHJvcGVydGllcyxcclxuICAgICAgICAgICAgbm9kZU1hcCxcclxuICAgICAgICAgICAgbm9kZXMsXHJcbiAgICAgICAgICAgIGVkZ2VzXHJcbiAgICAgICAgfSAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgc2VhcmNoTm9kZXMgKGdyYXBoUGF0aDogc3RyaW5nKSB7XHJcbiAgICAgICAgbGV0IGNvbnRlbnRTdHIgPSBmcy5yZWFkRmlsZVN5bmMoZ3JhcGhQYXRoLCAndXRmLTgnKVxyXG5cclxuICAgICAgICBpZiAoY29udGVudFN0ci5pbmNsdWRlcyhcIm1fU0dWZXJzaW9uXCIpKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2VhcmNoTm9kZXNWZXJzaW9uMyhjb250ZW50U3RyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbGV0IGNvbnRlbnQgPSBnZXRKc29uT2JqZWN0KGNvbnRlbnRTdHIpO1xyXG4gICAgICAgIGlmICghY29udGVudCkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgcHJvcGVydGllczogU2hhZGVyUHJvcGVyeVtdID0gY29udGVudC5tX1NlcmlhbGl6ZWRQcm9wZXJ0aWVzLm1hcChkID0+IG5ldyBTaGFkZXJQcm9wZXJ5KGQpKTtcclxuICAgICAgICBsZXQgbm9kZU1hcDogTWFwPHN0cmluZywgU2hhZGVyTm9kZT4gPSBuZXcgTWFwO1xyXG5cclxuICAgICAgICBsZXQgcHJvcGVydHlOb2RlTWFwOiBNYXA8U2hhZGVyUHJvcGVyeSwgUHJvcGVydHlOb2RlPiA9IG5ldyBNYXA7XHJcblxyXG4gICAgICAgIGxldCBub2RlczogU2hhZGVyTm9kZVtdID0gY29udGVudC5tX1NlcmlhbGl6YWJsZU5vZGVzLm1hcChkID0+IHtcclxuICAgICAgICAgICAgbGV0IG5vZGUgPSBjcmVhdGVOb2RlKGQpO1xyXG5cclxuICAgICAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBQcm9wZXJ0eU5vZGUpIHtcclxuICAgICAgICAgICAgICAgIG5vZGUuc2VhcmNoUHJvcGVydGllcyhwcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgbGV0IHByb3BlcnR5Tm9kZSA9IHByb3BlcnR5Tm9kZU1hcC5nZXQobm9kZS5wcm9wZXJ0eSEpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5vZGVNYXAuc2V0KG5vZGUudXVpZCwgcHJvcGVydHlOb2RlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcGVydHlOb2RlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHByb3BlcnR5Tm9kZU1hcC5zZXQobm9kZS5wcm9wZXJ0eSEsIG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgbm9kZU1hcC5zZXQobm9kZS51dWlkLCBub2RlKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5vZGU7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxldCBlZGdlczogU2hhZGVyRWRnZVtdID0gY29udGVudC5tX1NlcmlhbGl6YWJsZUVkZ2VzLm1hcChkID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBTaGFkZXJFZGdlKGQpXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlZGdlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgZWRnZSA9IGVkZ2VzW2ldO1xyXG4gICAgICAgICAgICBsZXQgaW5wdXRTbG90ID0gZWRnZS5pbnB1dDtcclxuICAgICAgICAgICAgbGV0IG91dHB1dFNsb3QgPSBlZGdlLm91dHB1dDtcclxuXHJcbiAgICAgICAgICAgIGxldCBpbnB1dE5vZGUgPSBub2RlTWFwLmdldChpbnB1dFNsb3Qubm9kZVV1aWQpO1xyXG4gICAgICAgICAgICBsZXQgb3V0cHV0Tm9kZSA9IG5vZGVNYXAuZ2V0KG91dHB1dFNsb3Qubm9kZVV1aWQpO1xyXG5cclxuICAgICAgICAgICAgaWYgKG91dHB1dE5vZGUgaW5zdGFuY2VvZiBTdWJHcmFwaE5vZGUpIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dE5vZGUgPSBvdXRwdXROb2RlLmV4Y2FobmdlU3ViR3JhcGhPdXROb2RlKG91dHB1dFNsb3QpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWlucHV0Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBDYW4gbm90IGZpbmQgaW5wdXQgWyR7aW5wdXRTbG90Lm5vZGVVdWlkfV0gZm9yIGVkZ2UuYClcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghb3V0cHV0Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBDYW4gbm90IGZpbmQgaW5wdXQgWyR7b3V0cHV0U2xvdC5ub2RlVXVpZH1dIGZvciBlZGdlLmApXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaW5wdXROb2RlLmFkZERlcGVuZGVuY3kob3V0cHV0Tm9kZSk7XHJcbiAgICAgICAgICAgIG91dHB1dE5vZGUuc2V0UHJpb3JpdHkoaW5wdXROb2RlLnByaW9yaXR5ICsgMSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgaW5wdXROb2RlU2xvdCA9IGlucHV0Tm9kZS5zbG90c01hcC5nZXQoaW5wdXRTbG90LmlkKTtcclxuICAgICAgICAgICAgbGV0IG91dHB1dE5vZGVTbG90ID0gb3V0cHV0Tm9kZS5zbG90c01hcC5nZXQob3V0cHV0U2xvdC5pZCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoaW5wdXROb2RlU2xvdCAmJiBvdXRwdXROb2RlU2xvdCkge1xyXG4gICAgICAgICAgICAgICAgaW5wdXROb2RlU2xvdC5jb25uZWN0U2xvdHMucHVzaChvdXRwdXROb2RlU2xvdCk7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXROb2RlU2xvdC5jb25uZWN0U2xvdHMucHVzaChpbnB1dE5vZGVTbG90KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbm9kZXMuc29ydCgoYSwgYikgPT4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpO1xyXG5cclxuICAgICAgICBub2Rlcy5mb3JFYWNoKG5vZGUgPT4ge1xyXG4gICAgICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFN1YkdyYXBoTm9kZSkge1xyXG4gICAgICAgICAgICAgICAgbm9kZS5leGNoYW5nZVN1YkdyYXBoSW5wdXROb2RlcygpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBub2RlLmNhbGNDb25jcmV0ZVByZWNpc2lvbigpO1xyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIHRoaXMuYWxsTm9kZXMucHVzaChub2Rlcyk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHByb3BlcnRpZXMsXHJcbiAgICAgICAgICAgIG5vZGVNYXAsXHJcbiAgICAgICAgICAgIG5vZGVzLFxyXG4gICAgICAgICAgICBlZGdlc1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgZGVjb2RlIChwYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXNldEdsb2JhbFNoYWRlclNsb3RJRCgpO1xyXG5cclxuICAgICAgICB0aGlzLmFsbE5vZGVzLmxlbmd0aCA9IDA7XHJcblxyXG4gICAgICAgIGxldCByZXMgPSB0aGlzLnNlYXJjaE5vZGVzKHBhdGgpO1xyXG4gICAgICAgIGlmICghcmVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB7IHByb3BlcnRpZXMsIG5vZGVNYXAsIG5vZGVzLCBlZGdlcyB9ID0gcmVzO1xyXG5cclxuICAgICAgICBsZXQgbWFzdGVyTm9kZSA9IG5vZGVzLmZpbmQobiA9PiBuIGluc3RhbmNlb2YgTWFzdGVyTm9kZSk7XHJcbiAgICAgICAgaWYgKCFtYXN0ZXJOb2RlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NhbiBub3QgZmluZCBtYXN0ZXIgbm9kZS4nKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgKG1hc3Rlck5vZGUgYXMgTWFzdGVyTm9kZSkucHJvcGVydGllcyA9IHByb3BlcnRpZXM7XHJcblxyXG4gICAgICAgIHRoaXMuYWxsTm9kZXMuZm9yRWFjaChub2RlcyA9PiB7XHJcbiAgICAgICAgICAgIG5vZGVzLmZvckVhY2gobm9kZSA9PiB7XHJcbiAgICAgICAgICAgICAgICBub2RlLmJlZm9yZUdlbnJlYXRlQ29kZSgpXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIGxldCBjb2RlID0gbWFzdGVyTm9kZS5nZW5lcmF0ZUNvZGUoKTtcclxuICAgICAgICByZXR1cm4gY29kZTtcclxuICAgIH1cclxufVxyXG4iXX0=