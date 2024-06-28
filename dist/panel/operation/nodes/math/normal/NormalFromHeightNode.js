"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("../../../base");
const type_1 = require("../../../type");
class NormalFromHeightNode extends base_1.ShaderNode {
    constructor() {
        super(...arguments);
        this.depChunks = ['normal'];
        this.depVarings = [type_1.WorldTangent];
    }
    generateCode() {
        return `${this.getOutputVarDefine(0)} = NormalFromHeight(${this.getInputValue(0)}, ${this.getInputValue(1)}, worldNormal, worldTangent, v_worldPos);`;
    }
}
exports.default = NormalFromHeightNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTm9ybWFsRnJvbUhlaWdodE5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zb3VyY2UvcGFuZWwvb3BlcmF0aW9uL25vZGVzL21hdGgvbm9ybWFsL05vcm1hbEZyb21IZWlnaHROb2RlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsd0NBQTJDO0FBQzNDLHdDQUE2QztBQUU3QyxNQUFxQixvQkFBcUIsU0FBUSxpQkFBVTtJQUE1RDs7UUFDSSxjQUFTLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQTtRQUN0QixlQUFVLEdBQUcsQ0FBQyxtQkFBWSxDQUFDLENBQUE7SUFJL0IsQ0FBQztJQUhHLFlBQVk7UUFDUixPQUFPLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyx1QkFBdUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQywyQ0FBMkMsQ0FBQztJQUMxSixDQUFDO0NBQ0o7QUFORCx1Q0FNQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNoYWRlck5vZGUgfSBmcm9tIFwiLi4vLi4vLi4vYmFzZVwiO1xyXG5pbXBvcnQgeyBXb3JsZFRhbmdlbnQgfSBmcm9tIFwiLi4vLi4vLi4vdHlwZVwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTm9ybWFsRnJvbUhlaWdodE5vZGUgZXh0ZW5kcyBTaGFkZXJOb2RlIHtcclxuICAgIGRlcENodW5rcyA9IFsnbm9ybWFsJ11cclxuICAgIGRlcFZhcmluZ3MgPSBbV29ybGRUYW5nZW50XVxyXG4gICAgZ2VuZXJhdGVDb2RlICgpIHtcclxuICAgICAgICByZXR1cm4gYCR7dGhpcy5nZXRPdXRwdXRWYXJEZWZpbmUoMCl9ID0gTm9ybWFsRnJvbUhlaWdodCgke3RoaXMuZ2V0SW5wdXRWYWx1ZSgwKX0sICR7dGhpcy5nZXRJbnB1dFZhbHVlKDEpfSwgd29ybGROb3JtYWwsIHdvcmxkVGFuZ2VudCwgdl93b3JsZFBvcyk7YDtcclxuICAgIH1cclxufVxyXG4iXX0=