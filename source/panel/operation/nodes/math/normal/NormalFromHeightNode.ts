import { ShaderNode } from "../../../base";
import { WorldTangent } from "../../../type";

export default class NormalFromHeightNode extends ShaderNode {
    depChunks = ['normal']
    depVarings = [WorldTangent]
    generateCode () {
        return `${this.getOutputVarDefine(0)} = NormalFromHeight(${this.getInputValue(0)}, ${this.getInputValue(1)}, worldNormal, worldTangent, v_worldPos);`;
    }
}
