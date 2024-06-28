"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("../../../base");
class NormalBlendNode extends base_1.ShaderNode {
    constructor() {
        super(...arguments);
        this.depChunks = ['normal'];
    }
    generateCode() {
        return `${this.getOutputVarDefine(0)} = BlendNormals(${this.getInputValue(0)}, ${this.getInputValue(1)});`;
    }
}
exports.default = NormalBlendNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTm9ybWFsQmxlbmROb2RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc291cmNlL3BhbmVsL29wZXJhdGlvbi9ub2Rlcy9tYXRoL25vcm1hbC9Ob3JtYWxCbGVuZE5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx3Q0FBMkM7QUFFM0MsTUFBcUIsZUFBZ0IsU0FBUSxpQkFBVTtJQUF2RDs7UUFDSSxjQUFTLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQTtJQUkxQixDQUFDO0lBSEcsWUFBWTtRQUNSLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUMvRyxDQUFDO0NBQ0o7QUFMRCxrQ0FLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNoYWRlck5vZGUgfSBmcm9tIFwiLi4vLi4vLi4vYmFzZVwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTm9ybWFsQmxlbmROb2RlIGV4dGVuZHMgU2hhZGVyTm9kZSB7XHJcbiAgICBkZXBDaHVua3MgPSBbJ25vcm1hbCddXHJcbiAgICBnZW5lcmF0ZUNvZGUgKCkge1xyXG4gICAgICAgIHJldHVybiBgJHt0aGlzLmdldE91dHB1dFZhckRlZmluZSgwKX0gPSBCbGVuZE5vcm1hbHMoJHt0aGlzLmdldElucHV0VmFsdWUoMCl9LCAke3RoaXMuZ2V0SW5wdXRWYWx1ZSgxKX0pO2A7XHJcbiAgICB9XHJcbn1cclxuIl19