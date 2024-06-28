"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("../../base");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const shadergraph_1 = __importDefault(require("../../shadergraph"));
const type_1 = require("../../type");
const utils_1 = require("../../utils");
const PROPERTY_NAME = '{{PROP_NAME}}';
const BOOLEAN_PROP_TEMPLATE = `
#if {{PROP_NAME}}_PROP
    bool {{PROP_NAME}} = true;
#else
    bool {{PROP_NAME}} = false;
#endif
`;
function findConnectNodes(slot, nodes) {
    if (!slot.connectSlot)
        return;
    let connectNode = slot.connectSlot.node;
    if (connectNode) {
        if (!nodes.includes(connectNode)) {
            nodes.push(connectNode);
        }
        else {
            return;
        }
        connectNode.inputSlots.forEach(slot => {
            findConnectNodes(slot, nodes);
        });
    }
}
class MasterNode extends base_1.ShaderNode {
    constructor() {
        super(...arguments);
        this.vsSlotIndices = [];
        this.fsSlotIndices = [];
        this.templatePath = '';
        this.isMasterNode = true;
        this.concretePrecisionType = type_1.ConcretePrecisionType.Fixed;
        this.properties = [];
    }
    getConnectNodes(slotIndices) {
        let inputSlots = [];
        slotIndices.forEach(name => {
            let slot = this.getSlotWithSlotName(name);
            if (slot) {
                inputSlots.push(slot);
            }
        });
        let nodes = [];
        inputSlots.forEach(slot => {
            findConnectNodes(slot, nodes);
        });
        nodes.sort((a, b) => b.priority - a.priority);
        return nodes;
    }
    generateVsCode() {
        let code = ['\n'];
        let nodes = this.getConnectNodes(this.vsSlotIndices);
        nodes.forEach(node => {
            node.generateCode().split('\n').forEach(c => {
                code.push('    ' + c);
            });
        });
        return code.join('\n');
    }
    generateFsCode() {
        let code = ['\n'];
        let nodes = this.getConnectNodes(this.fsSlotIndices);
        nodes.forEach(node => {
            node.generateCode().split('\n').forEach(c => {
                c += ` // ${node.constructor.name}`;
                code.push('    ' + c);
            });
        });
        return code.join('\n');
    }
    generatePropertiesCode() {
        let uniform = '\n';
        let mtl = '\n';
        let uniformSampler = '';
        let toggles = '\n';
        let properties = this.properties;
        properties.sort((a, b) => {
            return b.concretePrecision - a.concretePrecision;
        });
        let blockUniformCount = 0;
        properties.forEach(p => {
            let precision = '';
            let mtlValue = '';
            let value = p.defaultValue;
            let isColor = value.r !== undefined;
            let x = isColor ? value.r : value.x;
            let y = isColor ? value.g : value.y;
            let z = isColor ? value.b : value.z;
            let w = isColor ? value.a : value.w;
            let concretePrecision = p.node.outputSlots[0].concretePrecision;
            if (concretePrecision === 1) {
                precision = 'float';
                mtlValue = `${value}`;
            }
            else if (concretePrecision === 2) {
                precision = 'vec2';
                mtlValue = `[${x}, ${y}]`;
            }
            else if (concretePrecision === 3) {
                precision = 'vec4';
                mtlValue = `[${x}, ${y}, ${z}, 0]`;
            }
            else if (concretePrecision === 4) {
                precision = 'vec4';
                mtlValue = `[${x}, ${y}, ${z},  ${w}]`;
            }
            else if (concretePrecision === type_1.TextureConcretePrecision.Texture2D) {
                precision = 'sampler2D';
                mtlValue = 'white';
            }
            else if (concretePrecision === type_1.TextureConcretePrecision.TextureCube) {
                precision = 'samplerCube';
                mtlValue = 'white';
            }
            else if (concretePrecision === 5) {
                toggles += BOOLEAN_PROP_TEMPLATE.replace(/{{PROP_NAME}}/g, p.name);
            }
            let editorStr = isColor ? `, editor: { type: color }` : '';
            if (concretePrecision !== 5) {
                if (concretePrecision < type_1.TextureConcretePrecision.Texture2D) {
                    uniform += `    ${precision} ${p.name};\n`;
                    blockUniformCount++;
                }
                else {
                    uniformSampler += `  uniform ${precision} ${p.name};\n`;
                }
                mtl += `        ${p.name}: { value: ${mtlValue} ${editorStr}}\n`;
            }
        });
        if (blockUniformCount === 0) {
            uniform += '    vec4 empty_value;\n';
        }
        return {
            uniform,
            uniformSampler,
            mtl,
            toggles
        };
    }
    replaceChunks(code) {
        let depChunks = ['common'];
        let allNodes = shadergraph_1.default.allNodes;
        for (let i = 0; i < allNodes.length; i++) {
            for (let j = 0; j < allNodes[i].length; j++) {
                let node = allNodes[i][j];
                for (let k = 0; k < node.depChunks.length; k++) {
                    if (!depChunks.includes(node.depChunks[k])) {
                        depChunks.push(node.depChunks[k]);
                    }
                }
            }
        }
        let chunkIncludes = '\n';
        let chunks = '\n';
        depChunks.forEach(chunkName => {
            let chunkPath = path_1.default.join(utils_1.shaderTemplatesDir, `chunks/${chunkName}.chunk`);
            let chunk = fs_1.default.readFileSync(chunkPath, 'utf-8');
            if (!chunk) {
                console.error(`Can not find chunk with path [${chunkPath}]`);
                return;
            }
            chunks += chunk + '\n';
            chunkIncludes += `  #include <shader_graph_${chunkName}>\n`;
        });
        code = code.replace('{{chunks}}', chunks);
        code = code.replace('{{vs_chunks}}', chunkIncludes);
        code = code.replace('{{fs_chunks}}', chunkIncludes);
        return code;
    }
    generateVarings(code) {
        let depVarings = [];
        let allNodes = shadergraph_1.default.allNodes;
        allNodes.forEach(nodes => {
            nodes.forEach(node => {
                node.depVarings.forEach(varing => {
                    if (!depVarings.includes(varing)) {
                        depVarings.push(varing);
                    }
                });
            });
        });
        let vs_varing_define = [''];
        let vs_varing = [''];
        let fs_varing_define = [''];
        let fs_varing = [''];
        if (depVarings.includes(type_1.NormalSpace.World) || depVarings.includes(type_1.NormalSpace.View) || depVarings.includes(type_1.NormalSpace.Tangent) || depVarings.includes(type_1.NormalMapSpace)) {
            vs_varing.push('vec3 worldNormal = normalize((matWorldIT * vec4(normal, 0.0)).xyz);');
        }
        if (depVarings.includes(type_1.WorldTangent)) {
            vs_varing.push('vec3 worldTangent = normalize((matWorldIT * tangent).xyz);');
        }
        if (depVarings.includes(type_1.NormalSpace.View)) {
            vs_varing.push('vec3 viewNormal = normalize((cc_matView * vec4(worldNormal, 0.0)).xyz);');
        }
        if (depVarings.includes(type_1.NormalSpace.Tangent) || depVarings.includes(type_1.NormalMapSpace)) {
            vs_varing.push('v_tangent = normalize((matWorld * vec4(tangent.xyz, 0.0)).xyz);');
            vs_varing.push('v_bitangent = cross(worldNormal, v_tangent) * tangent.w;');
            vs_varing_define.push('out vec3 v_tangent;');
            vs_varing_define.push('out vec3 v_bitangent;');
            fs_varing_define.push('in vec3 v_tangent;');
            fs_varing_define.push('in vec3 v_bitangent;');
        }
        if (depVarings.includes(type_1.ViewDirectionSpace.World) || depVarings.includes(type_1.ViewDirectionSpace.View) || depVarings.includes(type_1.ViewDirectionSpace.Object)) {
            vs_varing.push('vec3 worldView = cc_cameraPos.xyz - worldPosition.xyz;');
        }
        if (depVarings.includes(type_1.ViewDirectionSpace.View)) {
            vs_varing.push('vec3 viewView = (cc_matView * vec4(worldView, 0.0))).xyz;');
        }
        if (depVarings.includes(type_1.ViewDirectionSpace.Object)) {
            vs_varing.push('vec3 view = (matWorldIT * vec4(worldView, 0.0)).xyz;');
        }
        // varing
        if (depVarings.includes(type_1.PositionSpace.Object)) {
            vs_varing_define.push('out vec3 v_pos;');
            vs_varing.push('v_pos = position.xyz;');
            fs_varing_define.push('in vec3 v_pos;');
            fs_varing.push('vec4 position = vec4(v_pos, 1.);');
        }
        if (depVarings.includes(type_1.PositionSpace.View)) {
            vs_varing_define.push('out vec3 v_viewPos;');
            vs_varing.push('v_viewPos = viewPosition.xyz;');
            fs_varing_define.push('in vec3 v_viewPos;');
            fs_varing.push('vec4 viewPosition = vec4(v_viewPos, 1.);');
        }
        if (depVarings.includes(type_1.PositionSpace.World) || depVarings.includes(type_1.PositionSpace.AbsoluteWorld)) {
            vs_varing_define.push('out vec3 v_worldPos;');
            vs_varing.push('v_worldPos = worldPosition.xyz;');
            fs_varing_define.push('in vec3 v_worldPos;');
            fs_varing.push('vec4 worldPosition = vec4(v_worldPos, 1.);');
        }
        if (depVarings.includes(type_1.NormalSpace.Object)) {
            vs_varing_define.push('out vec3 v_normal;');
            vs_varing.push('v_normal = normal;');
            fs_varing_define.push('in vec3 v_normal;');
            fs_varing.push('vec3 normal = v_normal;');
        }
        if (depVarings.includes(type_1.NormalSpace.View)) {
            vs_varing_define.push('out vec3 v_viewNormal;');
            vs_varing.push('v_viewNormal = viewNormal;');
            fs_varing_define.push('in vec3 v_viewNormal;');
            fs_varing.push('vec3 viewNormal = v_viewNormal;');
        }
        if (depVarings.includes(type_1.NormalSpace.World)) {
            vs_varing_define.push('out vec3 v_worldNormal;');
            vs_varing.push('v_worldNormal = worldNormal;');
            fs_varing_define.push('in vec3 v_worldNormal;');
            fs_varing.push('vec3 worldNormal = v_worldNormal;');
        }
        if (depVarings.includes(type_1.NormalSpace.Tangent)) {
        }
        if (depVarings.includes(type_1.ViewDirectionSpace.Object)) {
            vs_varing_define.push('out vec3 v_view;');
            vs_varing.push('v_view = view;');
            fs_varing_define.push('in vec3 v_view;');
            fs_varing.push('vec3 view = v_view;');
        }
        if (depVarings.includes(type_1.ViewDirectionSpace.View)) {
            vs_varing_define.push('out vec3 v_viewView;');
            vs_varing.push('v_viewView = viewView;');
            fs_varing_define.push('in vec3 v_viewView;');
            fs_varing.push('vec3 viewView = v_viewView;');
        }
        if (depVarings.includes(type_1.ViewDirectionSpace.World)) {
            vs_varing_define.push('out vec3 v_worldView;');
            vs_varing.push('v_worldView = worldView;');
            fs_varing_define.push('in vec3 v_worldView;');
            fs_varing.push('vec3 worldView = v_worldView;');
        }
        if (depVarings.includes(type_1.ViewDirectionSpace.Tangent)) {
        }
        if (depVarings.includes(type_1.WorldTangent)) {
            vs_varing_define.push('out vec3 v_worldTangent;');
            vs_varing.push('v_worldTangent = worldTangent;');
            fs_varing_define.push('in vec3 v_worldTangent;');
            fs_varing.push('vec3 worldTangent = v_worldTangent;');
        }
        code = code.replace('{{vs_varing_define}}', vs_varing_define.map(d => '  ' + d).join('\n'));
        code = code.replace('{{vs_varing}}', vs_varing.map(d => '    ' + d).join('\n'));
        code = code.replace('{{fs_varing_define}}', fs_varing_define.map(d => '  ' + d).join('\n'));
        code = code.replace('{{fs_varing}}', fs_varing.map(d => '    ' + d).join('\n'));
        return code;
    }
    generateCode() {
        let code = fs_1.default.readFileSync(this.templatePath, 'utf-8');
        code = this.generateVarings(code);
        const vsCode = this.generateVsCode();
        const fsCode = this.generateFsCode();
        code = code.replace('{{vs}}', vsCode);
        code = code.replace('{{fs}}', fsCode);
        code = this.replaceChunks(code);
        if (!this.properties || this.properties.length === 0) {
            code = code.replace(/properties: &props/g, '');
            code = code.replace(/properties: \*props/g, '');
        }
        let props = this.generatePropertiesCode();
        code = code.replace('{{properties}}', props.uniform);
        code = code.replace('{{properties_sampler}}', props.uniformSampler);
        code = code.replace('{{properties_mtl}}', props.mtl);
        code = code.replace('{{properties_booleans}}', props.toggles);
        // old shader graph version do not have vertex slots
        let vertexSlotNames = ['Vertex Position', 'Vertex Normal', 'Vertex Tangent', 'Position'];
        this.inputSlots.forEach(slot => {
            var tempName = `slot_${slot.displayName.replace(/ /g, '_')}`;
            let value;
            if (vertexSlotNames.includes(slot.displayName) || slot.displayName === 'Normal') {
                if (slot.connectSlot) {
                    value = slot.slotValue;
                }
            }
            else {
                value = slot.slotValue;
            }
            let reg = new RegExp(`{{${tempName} *=* *(.*)}}`);
            if (value === undefined) {
                let res = reg.exec(code);
                if (res) {
                    value = res[1];
                }
            }
            code = code.replace(reg, value);
        });
        vertexSlotNames.forEach(name => {
            var tempName = `slot_${name.replace(/ /g, '_')}`;
            let value = '';
            let reg = new RegExp(`{{${tempName} *=* *(.*)}}`);
            let res = reg.exec(code);
            if (res) {
                value = res[1];
            }
            code = code.replace(reg, value);
        });
        return code;
    }
}
exports.default = MasterNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWFzdGVyTm9kZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NvdXJjZS9wYW5lbC9vcGVyYXRpb24vbm9kZXMvbWFzdGVyL01hc3Rlck5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQ0FBbUU7QUFDbkUsNENBQW9CO0FBQ3BCLGdEQUF3QjtBQUN4QixvRUFBNEM7QUFDNUMscUNBQTJKO0FBQzNKLHVDQUFpRDtBQUVqRCxNQUFNLGFBQWEsR0FBRyxlQUFlLENBQUE7QUFFckMsTUFBTSxxQkFBcUIsR0FBRzs7Ozs7O0NBTTdCLENBQUE7QUFFRCxTQUFTLGdCQUFnQixDQUFFLElBQWdCLEVBQUUsS0FBbUI7SUFDNUQsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXO1FBQUUsT0FBTztJQUU5QixJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztJQUN4QyxJQUFJLFdBQVcsRUFBRTtRQUNiLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQzlCLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDM0I7YUFDSTtZQUNELE9BQU87U0FDVjtRQUVELFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2xDLGdCQUFnQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUMsQ0FBQTtLQUNMO0FBQ0wsQ0FBQztBQUVELE1BQXFCLFVBQVcsU0FBUSxpQkFBVTtJQUFsRDs7UUFFSSxrQkFBYSxHQUFhLEVBQUUsQ0FBQztRQUM3QixrQkFBYSxHQUFhLEVBQUUsQ0FBQztRQUU3QixpQkFBWSxHQUFHLEVBQUUsQ0FBQztRQUVsQixpQkFBWSxHQUFHLElBQUksQ0FBQztRQUNwQiwwQkFBcUIsR0FBRyw0QkFBcUIsQ0FBQyxLQUFLLENBQUM7UUFFcEQsZUFBVSxHQUFv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QUcsRUFBRSxDQUFDO1lBQ2YsSUFBSSxHQUFHLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxRQUFRLGNBQWMsQ0FBQyxDQUFDO1lBQ2xELElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDekIsSUFBSSxHQUFHLEVBQUU7Z0JBQ0wsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNsQjtZQUNELElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwQyxDQUFDLENBQUMsQ0FBQTtRQUVGLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7Q0FDSjtBQTdXRCw2QkE2V0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTaGFkZXJOb2RlLCBTaGFkZXJTbG90LCBTaGFkZXJQcm9wZXJ5IH0gZnJvbSBcIi4uLy4uL2Jhc2VcIjtcclxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCBTaGFkZXJHcmFwaCBmcm9tIFwiLi4vLi4vc2hhZGVyZ3JhcGhcIjtcclxuaW1wb3J0IHsgQ29uY3JldGVQcmVjaXNpb25UeXBlLCBUZXh0dXJlQ29uY3JldGVQcmVjaXNpb24sIE5vcm1hbFNwYWNlLCBOb3JtYWxNYXBTcGFjZSwgVmlld0RpcmVjdGlvblNwYWNlLCBQb3NpdGlvblNwYWNlLCBXb3JsZFRhbmdlbnQgfSBmcm9tIFwiLi4vLi4vdHlwZVwiO1xyXG5pbXBvcnQgeyBzaGFkZXJUZW1wbGF0ZXNEaXIgfSBmcm9tIFwiLi4vLi4vdXRpbHNcIjtcclxuXHJcbmNvbnN0IFBST1BFUlRZX05BTUUgPSAne3tQUk9QX05BTUV9fSdcclxuXHJcbmNvbnN0IEJPT0xFQU5fUFJPUF9URU1QTEFURSA9IGBcclxuI2lmIHt7UFJPUF9OQU1FfX1fUFJPUFxyXG4gICAgYm9vbCB7e1BST1BfTkFNRX19ID0gdHJ1ZTtcclxuI2Vsc2VcclxuICAgIGJvb2wge3tQUk9QX05BTUV9fSA9IGZhbHNlO1xyXG4jZW5kaWZcclxuYFxyXG5cclxuZnVuY3Rpb24gZmluZENvbm5lY3ROb2RlcyAoc2xvdDogU2hhZGVyU2xvdCwgbm9kZXM6IFNoYWRlck5vZGVbXSkge1xyXG4gICAgaWYgKCFzbG90LmNvbm5lY3RTbG90KSByZXR1cm47XHJcblxyXG4gICAgbGV0IGNvbm5lY3ROb2RlID0gc2xvdC5jb25uZWN0U2xvdC5ub2RlO1xyXG4gICAgaWYgKGNvbm5lY3ROb2RlKSB7XHJcbiAgICAgICAgaWYgKCFub2Rlcy5pbmNsdWRlcyhjb25uZWN0Tm9kZSkpIHtcclxuICAgICAgICAgICAgbm9kZXMucHVzaChjb25uZWN0Tm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25uZWN0Tm9kZS5pbnB1dFNsb3RzLmZvckVhY2goc2xvdCA9PiB7XHJcbiAgICAgICAgICAgIGZpbmRDb25uZWN0Tm9kZXMoc2xvdCwgbm9kZXMpO1xyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hc3Rlck5vZGUgZXh0ZW5kcyBTaGFkZXJOb2RlIHtcclxuXHJcbiAgICB2c1Nsb3RJbmRpY2VzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgZnNTbG90SW5kaWNlczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICB0ZW1wbGF0ZVBhdGggPSAnJztcclxuXHJcbiAgICBpc01hc3Rlck5vZGUgPSB0cnVlO1xyXG4gICAgY29uY3JldGVQcmVjaXNpb25UeXBlID0gQ29uY3JldGVQcmVjaXNpb25UeXBlLkZpeGVkO1xyXG5cclxuICAgIHByb3BlcnRpZXM6IFNoYWRlclByb3BlcnlbXSA9IFtdO1xyXG5cclxuICAgIGdldENvbm5lY3ROb2RlcyAoc2xvdEluZGljZXM6IHN0cmluZ1tdKSB7XHJcbiAgICAgICAgbGV0IGlucHV0U2xvdHM6IFNoYWRlclNsb3RbXSA9IFtdO1xyXG4gICAgICAgIHNsb3RJbmRpY2VzLmZvckVhY2gobmFtZSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBzbG90ID0gdGhpcy5nZXRTbG90V2l0aFNsb3ROYW1lKG5hbWUpXHJcbiAgICAgICAgICAgIGlmIChzbG90KSB7XHJcbiAgICAgICAgICAgICAgICBpbnB1dFNsb3RzLnB1c2goc2xvdClcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsZXQgbm9kZXM6IFNoYWRlck5vZGVbXSA9IFtdO1xyXG4gICAgICAgIGlucHV0U2xvdHMuZm9yRWFjaChzbG90ID0+IHtcclxuICAgICAgICAgICAgZmluZENvbm5lY3ROb2RlcyhzbG90LCBub2Rlcyk7XHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgbm9kZXMuc29ydCgoYSwgYikgPT4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpO1xyXG4gICAgICAgIHJldHVybiBub2RlcztcclxuICAgIH1cclxuXHJcbiAgICBnZW5lcmF0ZVZzQ29kZSAoKSB7XHJcbiAgICAgICAgbGV0IGNvZGU6IHN0cmluZ1tdID0gWydcXG4nXTtcclxuXHJcbiAgICAgICAgbGV0IG5vZGVzID0gdGhpcy5nZXRDb25uZWN0Tm9kZXModGhpcy52c1Nsb3RJbmRpY2VzKTtcclxuICAgICAgICBub2Rlcy5mb3JFYWNoKG5vZGUgPT4ge1xyXG4gICAgICAgICAgICBub2RlLmdlbmVyYXRlQ29kZSgpLnNwbGl0KCdcXG4nKS5mb3JFYWNoKGMgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29kZS5wdXNoKCcgICAgJyArIGMpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KVxyXG5cclxuXHJcbiAgICAgICAgcmV0dXJuIGNvZGUuam9pbignXFxuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2VuZXJhdGVGc0NvZGUgKCkge1xyXG4gICAgICAgIGxldCBjb2RlOiBzdHJpbmdbXSA9IFsnXFxuJ107XHJcblxyXG4gICAgICAgIGxldCBub2RlcyA9IHRoaXMuZ2V0Q29ubmVjdE5vZGVzKHRoaXMuZnNTbG90SW5kaWNlcyk7XHJcbiAgICAgICAgbm9kZXMuZm9yRWFjaChub2RlID0+IHtcclxuICAgICAgICAgICAgbm9kZS5nZW5lcmF0ZUNvZGUoKS5zcGxpdCgnXFxuJykuZm9yRWFjaChjID0+IHtcclxuICAgICAgICAgICAgICAgIGMgKz0gYCAvLyAke25vZGUuY29uc3RydWN0b3IubmFtZX1gXHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goJyAgICAnICsgYyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIHJldHVybiBjb2RlLmpvaW4oJ1xcbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGdlbmVyYXRlUHJvcGVydGllc0NvZGUgKCkge1xyXG4gICAgICAgIGxldCB1bmlmb3JtID0gJ1xcbic7XHJcbiAgICAgICAgbGV0IG10bCA9ICdcXG4nXHJcbiAgICAgICAgbGV0IHVuaWZvcm1TYW1wbGVyID0gJyc7XHJcbiAgICAgICAgbGV0IHRvZ2dsZXMgPSAnXFxuJ1xyXG5cclxuICAgICAgICBsZXQgcHJvcGVydGllcyA9IHRoaXMucHJvcGVydGllcztcclxuICAgICAgICBwcm9wZXJ0aWVzLnNvcnQoKGEsIGIpID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIGIuY29uY3JldGVQcmVjaXNpb24gLSBhLmNvbmNyZXRlUHJlY2lzaW9uO1xyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIGxldCBibG9ja1VuaWZvcm1Db3VudCA9IDA7XHJcblxyXG4gICAgICAgIHByb3BlcnRpZXMuZm9yRWFjaChwID0+IHtcclxuICAgICAgICAgICAgbGV0IHByZWNpc2lvbiA9ICcnO1xyXG4gICAgICAgICAgICBsZXQgbXRsVmFsdWUgPSAnJztcclxuXHJcbiAgICAgICAgICAgIGxldCB2YWx1ZSA9IHAuZGVmYXVsdFZhbHVlO1xyXG4gICAgICAgICAgICBsZXQgaXNDb2xvciA9IHZhbHVlLnIgIT09IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgbGV0IHggPSBpc0NvbG9yID8gdmFsdWUuciA6IHZhbHVlLng7XHJcbiAgICAgICAgICAgIGxldCB5ID0gaXNDb2xvciA/IHZhbHVlLmcgOiB2YWx1ZS55O1xyXG4gICAgICAgICAgICBsZXQgeiA9IGlzQ29sb3IgPyB2YWx1ZS5iIDogdmFsdWUuejtcclxuICAgICAgICAgICAgbGV0IHcgPSBpc0NvbG9yID8gdmFsdWUuYSA6IHZhbHVlLnc7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29uY3JldGVQcmVjaXNpb24gPSBwLm5vZGUhLm91dHB1dFNsb3RzWzBdLmNvbmNyZXRlUHJlY2lzaW9uO1xyXG5cclxuICAgICAgICAgICAgaWYgKGNvbmNyZXRlUHJlY2lzaW9uID09PSAxKSB7XHJcbiAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSAnZmxvYXQnO1xyXG4gICAgICAgICAgICAgICAgbXRsVmFsdWUgPSBgJHt2YWx1ZX1gXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoY29uY3JldGVQcmVjaXNpb24gPT09IDIpIHtcclxuICAgICAgICAgICAgICAgIHByZWNpc2lvbiA9ICd2ZWMyJztcclxuICAgICAgICAgICAgICAgIG10bFZhbHVlID0gYFske3h9LCAke3l9XWBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChjb25jcmV0ZVByZWNpc2lvbiA9PT0gMykge1xyXG4gICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gJ3ZlYzQnO1xyXG4gICAgICAgICAgICAgICAgbXRsVmFsdWUgPSBgWyR7eH0sICR7eX0sICR7en0sIDBdYFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKGNvbmNyZXRlUHJlY2lzaW9uID09PSA0KSB7XHJcbiAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSAndmVjNCc7XHJcbiAgICAgICAgICAgICAgICBtdGxWYWx1ZSA9IGBbJHt4fSwgJHt5fSwgJHt6fSwgICR7d31dYFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKGNvbmNyZXRlUHJlY2lzaW9uID09PSBUZXh0dXJlQ29uY3JldGVQcmVjaXNpb24uVGV4dHVyZTJEKSB7XHJcbiAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSAnc2FtcGxlcjJEJ1xyXG4gICAgICAgICAgICAgICAgbXRsVmFsdWUgPSAnd2hpdGUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoY29uY3JldGVQcmVjaXNpb24gPT09IFRleHR1cmVDb25jcmV0ZVByZWNpc2lvbi5UZXh0dXJlQ3ViZSkge1xyXG4gICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gJ3NhbXBsZXJDdWJlJ1xyXG4gICAgICAgICAgICAgICAgbXRsVmFsdWUgPSAnd2hpdGUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoY29uY3JldGVQcmVjaXNpb24gPT09IDUpe1xyXG4gICAgICAgICAgICAgICAgdG9nZ2xlcyArPSBCT09MRUFOX1BST1BfVEVNUExBVEUucmVwbGFjZSgve3tQUk9QX05BTUV9fS9nLCBwLm5hbWUpXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBlZGl0b3JTdHIgPSBpc0NvbG9yID8gYCwgZWRpdG9yOiB7IHR5cGU6IGNvbG9yIH1gIDogJydcclxuXHJcbiAgICAgICAgICAgIGlmIChjb25jcmV0ZVByZWNpc2lvbiAhPT0gNSlcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbmNyZXRlUHJlY2lzaW9uIDwgVGV4dHVyZUNvbmNyZXRlUHJlY2lzaW9uLlRleHR1cmUyRCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHVuaWZvcm0gKz0gYCAgICAke3ByZWNpc2lvbn0gJHtwLm5hbWV9O1xcbmA7XHJcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tVbmlmb3JtQ291bnQrKztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHVuaWZvcm1TYW1wbGVyICs9IGAgIHVuaWZvcm0gJHtwcmVjaXNpb259ICR7cC5uYW1lfTtcXG5gO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBtdGwgKz0gYCAgICAgICAgJHtwLm5hbWV9OiB7IHZhbHVlOiAke210bFZhbHVlfSAke2VkaXRvclN0cn19XFxuYFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgaWYgKGJsb2NrVW5pZm9ybUNvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIHVuaWZvcm0gKz0gJyAgICB2ZWM0IGVtcHR5X3ZhbHVlO1xcbidcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHVuaWZvcm0sXHJcbiAgICAgICAgICAgIHVuaWZvcm1TYW1wbGVyLFxyXG4gICAgICAgICAgICBtdGwsXHJcbiAgICAgICAgICAgIHRvZ2dsZXNcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHJlcGxhY2VDaHVua3MgKGNvZGUpIHtcclxuICAgICAgICBsZXQgZGVwQ2h1bmtzOiBzdHJpbmdbXSA9IFsnY29tbW9uJ107XHJcbiAgICAgICAgbGV0IGFsbE5vZGVzID0gU2hhZGVyR3JhcGguYWxsTm9kZXM7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxOb2Rlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGFsbE5vZGVzW2ldLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbm9kZSA9IGFsbE5vZGVzW2ldW2pdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBub2RlLmRlcENodW5rcy5sZW5ndGg7IGsrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVwQ2h1bmtzLmluY2x1ZGVzKG5vZGUuZGVwQ2h1bmtzW2tdKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXBDaHVua3MucHVzaChub2RlLmRlcENodW5rc1trXSlcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBjaHVua0luY2x1ZGVzID0gJ1xcbic7XHJcbiAgICAgICAgbGV0IGNodW5rcyA9ICdcXG4nO1xyXG4gICAgICAgIGRlcENodW5rcy5mb3JFYWNoKGNodW5rTmFtZSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjaHVua1BhdGggPSBwYXRoLmpvaW4oc2hhZGVyVGVtcGxhdGVzRGlyLCBgY2h1bmtzLyR7Y2h1bmtOYW1lfS5jaHVua2ApO1xyXG4gICAgICAgICAgICBsZXQgY2h1bmsgPSBmcy5yZWFkRmlsZVN5bmMoY2h1bmtQYXRoLCAndXRmLTgnKTtcclxuICAgICAgICAgICAgaWYgKCFjaHVuaykge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgQ2FuIG5vdCBmaW5kIGNodW5rIHdpdGggcGF0aCBbJHtjaHVua1BhdGh9XWApXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2h1bmtzICs9IGNodW5rICsgJ1xcbic7XHJcbiAgICAgICAgICAgIGNodW5rSW5jbHVkZXMgKz0gYCAgI2luY2x1ZGUgPHNoYWRlcl9ncmFwaF8ke2NodW5rTmFtZX0+XFxuYDtcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICBjb2RlID0gY29kZS5yZXBsYWNlKCd7e2NodW5rc319JywgY2h1bmtzKTtcclxuICAgICAgICBjb2RlID0gY29kZS5yZXBsYWNlKCd7e3ZzX2NodW5rc319JywgY2h1bmtJbmNsdWRlcyk7XHJcbiAgICAgICAgY29kZSA9IGNvZGUucmVwbGFjZSgne3tmc19jaHVua3N9fScsIGNodW5rSW5jbHVkZXMpO1xyXG5cclxuICAgICAgICByZXR1cm4gY29kZTtcclxuICAgIH1cclxuXHJcbiAgICBnZW5lcmF0ZVZhcmluZ3MgKGNvZGUpIHtcclxuICAgICAgICBsZXQgZGVwVmFyaW5nczogbnVtYmVyW10gPSBbXVxyXG4gICAgICAgIGxldCBhbGxOb2RlcyA9IFNoYWRlckdyYXBoLmFsbE5vZGVzO1xyXG4gICAgICAgIGFsbE5vZGVzLmZvckVhY2gobm9kZXMgPT4ge1xyXG4gICAgICAgICAgICBub2Rlcy5mb3JFYWNoKG5vZGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgbm9kZS5kZXBWYXJpbmdzLmZvckVhY2godmFyaW5nID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRlcFZhcmluZ3MuaW5jbHVkZXModmFyaW5nKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXBWYXJpbmdzLnB1c2godmFyaW5nKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIGxldCB2c192YXJpbmdfZGVmaW5lOiBzdHJpbmdbXSA9IFsnJ11cclxuICAgICAgICBsZXQgdnNfdmFyaW5nOiBzdHJpbmdbXSA9IFsnJ11cclxuICAgICAgICBsZXQgZnNfdmFyaW5nX2RlZmluZTogc3RyaW5nW10gPSBbJyddXHJcbiAgICAgICAgbGV0IGZzX3ZhcmluZzogc3RyaW5nW10gPSBbJyddXHJcblxyXG5cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhOb3JtYWxTcGFjZS5Xb3JsZCkgfHwgZGVwVmFyaW5ncy5pbmNsdWRlcyhOb3JtYWxTcGFjZS5WaWV3KSB8fCBkZXBWYXJpbmdzLmluY2x1ZGVzKE5vcm1hbFNwYWNlLlRhbmdlbnQpIHx8IGRlcFZhcmluZ3MuaW5jbHVkZXMoTm9ybWFsTWFwU3BhY2UpKSB7XHJcbiAgICAgICAgICAgIHZzX3ZhcmluZy5wdXNoKCd2ZWMzIHdvcmxkTm9ybWFsID0gbm9ybWFsaXplKChtYXRXb3JsZElUICogdmVjNChub3JtYWwsIDAuMCkpLnh5eik7Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZXBWYXJpbmdzLmluY2x1ZGVzKFdvcmxkVGFuZ2VudCkpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB2c192YXJpbmcucHVzaCgndmVjMyB3b3JsZFRhbmdlbnQgPSBub3JtYWxpemUoKG1hdFdvcmxkSVQgKiB0YW5nZW50KS54eXopOycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhOb3JtYWxTcGFjZS5WaWV3KSkge1xyXG4gICAgICAgICAgICB2c192YXJpbmcucHVzaCgndmVjMyB2aWV3Tm9ybWFsID0gbm9ybWFsaXplKChjY19tYXRWaWV3ICogdmVjNCh3b3JsZE5vcm1hbCwgMC4wKSkueHl6KTsnKVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhOb3JtYWxTcGFjZS5UYW5nZW50KSB8fCBkZXBWYXJpbmdzLmluY2x1ZGVzKE5vcm1hbE1hcFNwYWNlKSkge1xyXG4gICAgICAgICAgICB2c192YXJpbmcucHVzaCgndl90YW5nZW50ID0gbm9ybWFsaXplKChtYXRXb3JsZCAqIHZlYzQodGFuZ2VudC54eXosIDAuMCkpLnh5eik7JylcclxuICAgICAgICAgICAgdnNfdmFyaW5nLnB1c2goJ3ZfYml0YW5nZW50ID0gY3Jvc3Mod29ybGROb3JtYWwsIHZfdGFuZ2VudCkgKiB0YW5nZW50Lnc7JylcclxuXHJcbiAgICAgICAgICAgIHZzX3ZhcmluZ19kZWZpbmUucHVzaCgnb3V0IHZlYzMgdl90YW5nZW50OycpXHJcbiAgICAgICAgICAgIHZzX3ZhcmluZ19kZWZpbmUucHVzaCgnb3V0IHZlYzMgdl9iaXRhbmdlbnQ7JylcclxuXHJcbiAgICAgICAgICAgIGZzX3ZhcmluZ19kZWZpbmUucHVzaCgnaW4gdmVjMyB2X3RhbmdlbnQ7JylcclxuICAgICAgICAgICAgZnNfdmFyaW5nX2RlZmluZS5wdXNoKCdpbiB2ZWMzIHZfYml0YW5nZW50OycpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhWaWV3RGlyZWN0aW9uU3BhY2UuV29ybGQpIHx8IGRlcFZhcmluZ3MuaW5jbHVkZXMoVmlld0RpcmVjdGlvblNwYWNlLlZpZXcpIHx8IGRlcFZhcmluZ3MuaW5jbHVkZXMoVmlld0RpcmVjdGlvblNwYWNlLk9iamVjdCkpIHtcclxuICAgICAgICAgICAgdnNfdmFyaW5nLnB1c2goJ3ZlYzMgd29ybGRWaWV3ID0gY2NfY2FtZXJhUG9zLnh5eiAtIHdvcmxkUG9zaXRpb24ueHl6OycpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZXBWYXJpbmdzLmluY2x1ZGVzKFZpZXdEaXJlY3Rpb25TcGFjZS5WaWV3KSkge1xyXG4gICAgICAgICAgICB2c192YXJpbmcucHVzaCgndmVjMyB2aWV3VmlldyA9IChjY19tYXRWaWV3ICogdmVjNCh3b3JsZFZpZXcsIDAuMCkpKS54eXo7JylcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRlcFZhcmluZ3MuaW5jbHVkZXMoVmlld0RpcmVjdGlvblNwYWNlLk9iamVjdCkpIHtcclxuICAgICAgICAgICAgdnNfdmFyaW5nLnB1c2goJ3ZlYzMgdmlldyA9IChtYXRXb3JsZElUICogdmVjNCh3b3JsZFZpZXcsIDAuMCkpLnh5ejsnKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gdmFyaW5nXHJcbiAgICAgICAgaWYgKGRlcFZhcmluZ3MuaW5jbHVkZXMoUG9zaXRpb25TcGFjZS5PYmplY3QpKSB7XHJcbiAgICAgICAgICAgIHZzX3ZhcmluZ19kZWZpbmUucHVzaCgnb3V0IHZlYzMgdl9wb3M7JylcclxuICAgICAgICAgICAgdnNfdmFyaW5nLnB1c2goJ3ZfcG9zID0gcG9zaXRpb24ueHl6OycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmdfZGVmaW5lLnB1c2goJ2luIHZlYzMgdl9wb3M7Jyk7XHJcbiAgICAgICAgICAgIGZzX3ZhcmluZy5wdXNoKCd2ZWM0IHBvc2l0aW9uID0gdmVjNCh2X3BvcywgMS4pOycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhQb3NpdGlvblNwYWNlLlZpZXcpKSB7XHJcbiAgICAgICAgICAgIHZzX3ZhcmluZ19kZWZpbmUucHVzaCgnb3V0IHZlYzMgdl92aWV3UG9zOycpXHJcbiAgICAgICAgICAgIHZzX3ZhcmluZy5wdXNoKCd2X3ZpZXdQb3MgPSB2aWV3UG9zaXRpb24ueHl6OycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmdfZGVmaW5lLnB1c2goJ2luIHZlYzMgdl92aWV3UG9zOycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmcucHVzaCgndmVjNCB2aWV3UG9zaXRpb24gPSB2ZWM0KHZfdmlld1BvcywgMS4pOycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhQb3NpdGlvblNwYWNlLldvcmxkKSB8fCBkZXBWYXJpbmdzLmluY2x1ZGVzKFBvc2l0aW9uU3BhY2UuQWJzb2x1dGVXb3JsZCkpIHtcclxuICAgICAgICAgICAgdnNfdmFyaW5nX2RlZmluZS5wdXNoKCdvdXQgdmVjMyB2X3dvcmxkUG9zOycpXHJcbiAgICAgICAgICAgIHZzX3ZhcmluZy5wdXNoKCd2X3dvcmxkUG9zID0gd29ybGRQb3NpdGlvbi54eXo7Jyk7XHJcbiAgICAgICAgICAgIGZzX3ZhcmluZ19kZWZpbmUucHVzaCgnaW4gdmVjMyB2X3dvcmxkUG9zOycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmcucHVzaCgndmVjNCB3b3JsZFBvc2l0aW9uID0gdmVjNCh2X3dvcmxkUG9zLCAxLik7Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZXBWYXJpbmdzLmluY2x1ZGVzKE5vcm1hbFNwYWNlLk9iamVjdCkpIHtcclxuICAgICAgICAgICAgdnNfdmFyaW5nX2RlZmluZS5wdXNoKCdvdXQgdmVjMyB2X25vcm1hbDsnKVxyXG4gICAgICAgICAgICB2c192YXJpbmcucHVzaCgndl9ub3JtYWwgPSBub3JtYWw7Jyk7XHJcbiAgICAgICAgICAgIGZzX3ZhcmluZ19kZWZpbmUucHVzaCgnaW4gdmVjMyB2X25vcm1hbDsnKTtcclxuICAgICAgICAgICAgZnNfdmFyaW5nLnB1c2goJ3ZlYzMgbm9ybWFsID0gdl9ub3JtYWw7Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZXBWYXJpbmdzLmluY2x1ZGVzKE5vcm1hbFNwYWNlLlZpZXcpKSB7XHJcbiAgICAgICAgICAgIHZzX3ZhcmluZ19kZWZpbmUucHVzaCgnb3V0IHZlYzMgdl92aWV3Tm9ybWFsOycpXHJcbiAgICAgICAgICAgIHZzX3ZhcmluZy5wdXNoKCd2X3ZpZXdOb3JtYWwgPSB2aWV3Tm9ybWFsOycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmdfZGVmaW5lLnB1c2goJ2luIHZlYzMgdl92aWV3Tm9ybWFsOycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmcucHVzaCgndmVjMyB2aWV3Tm9ybWFsID0gdl92aWV3Tm9ybWFsOycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhOb3JtYWxTcGFjZS5Xb3JsZCkpIHtcclxuICAgICAgICAgICAgdnNfdmFyaW5nX2RlZmluZS5wdXNoKCdvdXQgdmVjMyB2X3dvcmxkTm9ybWFsOycpXHJcbiAgICAgICAgICAgIHZzX3ZhcmluZy5wdXNoKCd2X3dvcmxkTm9ybWFsID0gd29ybGROb3JtYWw7Jyk7XHJcbiAgICAgICAgICAgIGZzX3ZhcmluZ19kZWZpbmUucHVzaCgnaW4gdmVjMyB2X3dvcmxkTm9ybWFsOycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmcucHVzaCgndmVjMyB3b3JsZE5vcm1hbCA9IHZfd29ybGROb3JtYWw7Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZXBWYXJpbmdzLmluY2x1ZGVzKE5vcm1hbFNwYWNlLlRhbmdlbnQpKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhWaWV3RGlyZWN0aW9uU3BhY2UuT2JqZWN0KSkge1xyXG4gICAgICAgICAgICB2c192YXJpbmdfZGVmaW5lLnB1c2goJ291dCB2ZWMzIHZfdmlldzsnKVxyXG4gICAgICAgICAgICB2c192YXJpbmcucHVzaCgndl92aWV3ID0gdmlldzsnKTtcclxuICAgICAgICAgICAgZnNfdmFyaW5nX2RlZmluZS5wdXNoKCdpbiB2ZWMzIHZfdmlldzsnKTtcclxuICAgICAgICAgICAgZnNfdmFyaW5nLnB1c2goJ3ZlYzMgdmlldyA9IHZfdmlldzsnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRlcFZhcmluZ3MuaW5jbHVkZXMoVmlld0RpcmVjdGlvblNwYWNlLlZpZXcpKSB7XHJcbiAgICAgICAgICAgIHZzX3ZhcmluZ19kZWZpbmUucHVzaCgnb3V0IHZlYzMgdl92aWV3VmlldzsnKVxyXG4gICAgICAgICAgICB2c192YXJpbmcucHVzaCgndl92aWV3VmlldyA9IHZpZXdWaWV3OycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmdfZGVmaW5lLnB1c2goJ2luIHZlYzMgdl92aWV3VmlldzsnKTtcclxuICAgICAgICAgICAgZnNfdmFyaW5nLnB1c2goJ3ZlYzMgdmlld1ZpZXcgPSB2X3ZpZXdWaWV3OycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhWaWV3RGlyZWN0aW9uU3BhY2UuV29ybGQpKSB7XHJcbiAgICAgICAgICAgIHZzX3ZhcmluZ19kZWZpbmUucHVzaCgnb3V0IHZlYzMgdl93b3JsZFZpZXc7JylcclxuICAgICAgICAgICAgdnNfdmFyaW5nLnB1c2goJ3Zfd29ybGRWaWV3ID0gd29ybGRWaWV3OycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmdfZGVmaW5lLnB1c2goJ2luIHZlYzMgdl93b3JsZFZpZXc7Jyk7XHJcbiAgICAgICAgICAgIGZzX3ZhcmluZy5wdXNoKCd2ZWMzIHdvcmxkVmlldyA9IHZfd29ybGRWaWV3OycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVwVmFyaW5ncy5pbmNsdWRlcyhWaWV3RGlyZWN0aW9uU3BhY2UuVGFuZ2VudCkpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZXBWYXJpbmdzLmluY2x1ZGVzKFdvcmxkVGFuZ2VudCkpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB2c192YXJpbmdfZGVmaW5lLnB1c2goJ291dCB2ZWMzIHZfd29ybGRUYW5nZW50OycpXHJcbiAgICAgICAgICAgIHZzX3ZhcmluZy5wdXNoKCd2X3dvcmxkVGFuZ2VudCA9IHdvcmxkVGFuZ2VudDsnKTtcclxuICAgICAgICAgICAgZnNfdmFyaW5nX2RlZmluZS5wdXNoKCdpbiB2ZWMzIHZfd29ybGRUYW5nZW50OycpO1xyXG4gICAgICAgICAgICBmc192YXJpbmcucHVzaCgndmVjMyB3b3JsZFRhbmdlbnQgPSB2X3dvcmxkVGFuZ2VudDsnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvZGUgPSBjb2RlLnJlcGxhY2UoJ3t7dnNfdmFyaW5nX2RlZmluZX19JywgdnNfdmFyaW5nX2RlZmluZS5tYXAoZCA9PiAnICAnICsgZCkuam9pbignXFxuJykpXHJcbiAgICAgICAgY29kZSA9IGNvZGUucmVwbGFjZSgne3t2c192YXJpbmd9fScsIHZzX3ZhcmluZy5tYXAoZCA9PiAnICAgICcgKyBkKS5qb2luKCdcXG4nKSlcclxuICAgICAgICBcclxuICAgICAgICBjb2RlID0gY29kZS5yZXBsYWNlKCd7e2ZzX3ZhcmluZ19kZWZpbmV9fScsIGZzX3ZhcmluZ19kZWZpbmUubWFwKGQgPT4gJyAgJyArIGQpLmpvaW4oJ1xcbicpKVxyXG4gICAgICAgIGNvZGUgPSBjb2RlLnJlcGxhY2UoJ3t7ZnNfdmFyaW5nfX0nLCBmc192YXJpbmcubWFwKGQgPT4gJyAgICAnICsgZCkuam9pbignXFxuJykpXHJcblxyXG4gICAgICAgIHJldHVybiBjb2RlO1xyXG4gICAgfVxyXG5cclxuICAgIGdlbmVyYXRlQ29kZSAoKSB7XHJcbiAgICAgICAgbGV0IGNvZGUgPSBmcy5yZWFkRmlsZVN5bmModGhpcy50ZW1wbGF0ZVBhdGgsICd1dGYtOCcpO1xyXG5cclxuICAgICAgICBjb2RlID0gdGhpcy5nZW5lcmF0ZVZhcmluZ3MoY29kZSk7XHJcblxyXG4gICAgICAgIGNvbnN0IHZzQ29kZSA9IHRoaXMuZ2VuZXJhdGVWc0NvZGUoKTtcclxuICAgICAgICBjb25zdCBmc0NvZGUgPSB0aGlzLmdlbmVyYXRlRnNDb2RlKCk7XHJcblxyXG4gICAgICAgIGNvZGUgPSBjb2RlLnJlcGxhY2UoJ3t7dnN9fScsIHZzQ29kZSk7XHJcbiAgICAgICAgY29kZSA9IGNvZGUucmVwbGFjZSgne3tmc319JywgZnNDb2RlKTtcclxuXHJcbiAgICAgICAgY29kZSA9IHRoaXMucmVwbGFjZUNodW5rcyhjb2RlKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLnByb3BlcnRpZXMgfHwgdGhpcy5wcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBjb2RlID0gY29kZS5yZXBsYWNlKC9wcm9wZXJ0aWVzOiAmcHJvcHMvZywgJycpO1xyXG4gICAgICAgICAgICBjb2RlID0gY29kZS5yZXBsYWNlKC9wcm9wZXJ0aWVzOiBcXCpwcm9wcy9nLCAnJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcHJvcHMgPSB0aGlzLmdlbmVyYXRlUHJvcGVydGllc0NvZGUoKTtcclxuICAgICAgICBjb2RlID0gY29kZS5yZXBsYWNlKCd7e3Byb3BlcnRpZXN9fScsIHByb3BzLnVuaWZvcm0pO1xyXG4gICAgICAgIGNvZGUgPSBjb2RlLnJlcGxhY2UoJ3t7cHJvcGVydGllc19zYW1wbGVyfX0nLCBwcm9wcy51bmlmb3JtU2FtcGxlcik7XHJcbiAgICAgICAgY29kZSA9IGNvZGUucmVwbGFjZSgne3twcm9wZXJ0aWVzX210bH19JywgcHJvcHMubXRsKTsgXHJcbiAgICAgICAgY29kZSA9IGNvZGUucmVwbGFjZSgne3twcm9wZXJ0aWVzX2Jvb2xlYW5zfX0nLCBwcm9wcy50b2dnbGVzKVxyXG5cclxuICAgICAgICBcclxuICAgICAgICAvLyBvbGQgc2hhZGVyIGdyYXBoIHZlcnNpb24gZG8gbm90IGhhdmUgdmVydGV4IHNsb3RzXHJcbiAgICAgICAgbGV0IHZlcnRleFNsb3ROYW1lcyA9IFsnVmVydGV4IFBvc2l0aW9uJywgJ1ZlcnRleCBOb3JtYWwnLCAnVmVydGV4IFRhbmdlbnQnLCAnUG9zaXRpb24nXTtcclxuXHJcbiAgICAgICAgdGhpcy5pbnB1dFNsb3RzLmZvckVhY2goc2xvdCA9PiB7XHJcbiAgICAgICAgICAgIHZhciB0ZW1wTmFtZSA9IGBzbG90XyR7c2xvdC5kaXNwbGF5TmFtZS5yZXBsYWNlKC8gL2csICdfJyl9YDtcclxuICAgICAgICAgICAgbGV0IHZhbHVlO1xyXG4gICAgICAgICAgICBpZiAodmVydGV4U2xvdE5hbWVzLmluY2x1ZGVzKHNsb3QuZGlzcGxheU5hbWUpIHx8IHNsb3QuZGlzcGxheU5hbWUgPT09ICdOb3JtYWwnKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc2xvdC5jb25uZWN0U2xvdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gc2xvdC5zbG90VmFsdWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNsb3Quc2xvdFZhbHVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsZXQgcmVnID0gbmV3IFJlZ0V4cChge3ske3RlbXBOYW1lfSAqPSogKiguKil9fWApO1xyXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IHJlcyA9IHJlZy5leGVjKGNvZGUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcmVzWzFdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvZGUgPSBjb2RlLnJlcGxhY2UocmVnLCB2YWx1ZSk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICBcclxuICAgICAgICB2ZXJ0ZXhTbG90TmFtZXMuZm9yRWFjaChuYW1lID0+IHtcclxuICAgICAgICAgICAgdmFyIHRlbXBOYW1lID0gYHNsb3RfJHtuYW1lLnJlcGxhY2UoLyAvZywgJ18nKX1gO1xyXG4gICAgICAgICAgICBsZXQgdmFsdWUgPSAnJztcclxuICAgICAgICAgICAgbGV0IHJlZyA9IG5ldyBSZWdFeHAoYHt7JHt0ZW1wTmFtZX0gKj0qICooLiopfX1gKTtcclxuICAgICAgICAgICAgbGV0IHJlcyA9IHJlZy5leGVjKGNvZGUpO1xyXG4gICAgICAgICAgICBpZiAocmVzKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHJlc1sxXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb2RlID0gY29kZS5yZXBsYWNlKHJlZywgdmFsdWUpO1xyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIHJldHVybiBjb2RlO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==