import { ShaderNode } from "../../../base";

export default class BranchNode extends ShaderNode {

    generateCode () {
        let cond = this.getInputValue(0);
        let a = this.getInputValue(1);
        let b = this.getInputValue(2);
        return `${this.getOutputVarDefine(0)} = (${cond}) ? (${a}) : (${b});`;
    }
}

