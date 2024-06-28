import { ShaderNode } from "../../../base";

export default class NormalBlendNode extends ShaderNode {
    depChunks = ['normal']
    generateCode () {
        return `${this.getOutputVarDefine(0)} = BlendNormals(${this.getInputValue(0)}, ${this.getInputValue(1)});`;
    }
}
