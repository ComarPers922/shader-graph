"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorldTangent = exports.NormalMapSpace = exports.ViewDirectionSpace = exports.NormalSpace = exports.PositionSpace = exports.TextureConcretePrecision = exports.ConcretePrecisionType = void 0;
var ConcretePrecisionType;
(function (ConcretePrecisionType) {
    ConcretePrecisionType[ConcretePrecisionType["Min"] = 0] = "Min";
    ConcretePrecisionType[ConcretePrecisionType["Max"] = 1] = "Max";
    ConcretePrecisionType[ConcretePrecisionType["Fixed"] = 2] = "Fixed";
    ConcretePrecisionType[ConcretePrecisionType["Texture"] = 3] = "Texture";
})(ConcretePrecisionType = exports.ConcretePrecisionType || (exports.ConcretePrecisionType = {}));
var TextureConcretePrecision;
(function (TextureConcretePrecision) {
    TextureConcretePrecision[TextureConcretePrecision["Texture2D"] = 100] = "Texture2D";
    TextureConcretePrecision[TextureConcretePrecision["TextureCube"] = 101] = "TextureCube";
})(TextureConcretePrecision = exports.TextureConcretePrecision || (exports.TextureConcretePrecision = {}));
;
var PositionSpace;
(function (PositionSpace) {
    PositionSpace[PositionSpace["Object"] = 0] = "Object";
    PositionSpace[PositionSpace["View"] = 1] = "View";
    PositionSpace[PositionSpace["World"] = 2] = "World";
    PositionSpace[PositionSpace["Tangent"] = 3] = "Tangent";
    PositionSpace[PositionSpace["AbsoluteWorld"] = 4] = "AbsoluteWorld";
})(PositionSpace = exports.PositionSpace || (exports.PositionSpace = {}));
var NormalSpace;
(function (NormalSpace) {
    NormalSpace[NormalSpace["Object"] = 100] = "Object";
    NormalSpace[NormalSpace["View"] = 101] = "View";
    NormalSpace[NormalSpace["World"] = 102] = "World";
    NormalSpace[NormalSpace["Tangent"] = 103] = "Tangent";
})(NormalSpace = exports.NormalSpace || (exports.NormalSpace = {}));
var ViewDirectionSpace;
(function (ViewDirectionSpace) {
    ViewDirectionSpace[ViewDirectionSpace["Object"] = 200] = "Object";
    ViewDirectionSpace[ViewDirectionSpace["View"] = 201] = "View";
    ViewDirectionSpace[ViewDirectionSpace["World"] = 202] = "World";
    ViewDirectionSpace[ViewDirectionSpace["Tangent"] = 203] = "Tangent";
})(ViewDirectionSpace = exports.ViewDirectionSpace || (exports.ViewDirectionSpace = {}));
exports.NormalMapSpace = 300;
exports.WorldTangent = 400;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS9wYW5lbC9vcGVyYXRpb24vdHlwZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxJQUFZLHFCQUtYO0FBTEQsV0FBWSxxQkFBcUI7SUFDN0IsK0RBQUcsQ0FBQTtJQUNILCtEQUFHLENBQUE7SUFDSCxtRUFBSyxDQUFBO0lBQ0wsdUVBQU8sQ0FBQTtBQUNYLENBQUMsRUFMVyxxQkFBcUIsR0FBckIsNkJBQXFCLEtBQXJCLDZCQUFxQixRQUtoQztBQUVELElBQVksd0JBR1g7QUFIRCxXQUFZLHdCQUF3QjtJQUNoQyxtRkFBZSxDQUFBO0lBQ2YsdUZBQWlCLENBQUE7QUFDckIsQ0FBQyxFQUhXLHdCQUF3QixHQUF4QixnQ0FBd0IsS0FBeEIsZ0NBQXdCLFFBR25DO0FBQUEsQ0FBQztBQUdGLElBQVksYUFNWDtBQU5ELFdBQVksYUFBYTtJQUNyQixxREFBVSxDQUFBO0lBQ1YsaURBQUksQ0FBQTtJQUNKLG1EQUFLLENBQUE7SUFDTCx1REFBTyxDQUFBO0lBQ1AsbUVBQWEsQ0FBQTtBQUNqQixDQUFDLEVBTlcsYUFBYSxHQUFiLHFCQUFhLEtBQWIscUJBQWEsUUFNeEI7QUFFRCxJQUFZLFdBS1g7QUFMRCxXQUFZLFdBQVc7SUFDbkIsbURBQVksQ0FBQTtJQUNaLCtDQUFJLENBQUE7SUFDSixpREFBSyxDQUFBO0lBQ0wscURBQU8sQ0FBQTtBQUNYLENBQUMsRUFMVyxXQUFXLEdBQVgsbUJBQVcsS0FBWCxtQkFBVyxRQUt0QjtBQUVELElBQVksa0JBS1g7QUFMRCxXQUFZLGtCQUFrQjtJQUMxQixpRUFBWSxDQUFBO0lBQ1osNkRBQUksQ0FBQTtJQUNKLCtEQUFLLENBQUE7SUFDTCxtRUFBTyxDQUFBO0FBQ1gsQ0FBQyxFQUxXLGtCQUFrQixHQUFsQiwwQkFBa0IsS0FBbEIsMEJBQWtCLFFBSzdCO0FBRVksUUFBQSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBRXJCLFFBQUEsWUFBWSxHQUFHLEdBQUcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlxyXG5leHBvcnQgZW51bSBDb25jcmV0ZVByZWNpc2lvblR5cGUge1xyXG4gICAgTWluLFxyXG4gICAgTWF4LFxyXG4gICAgRml4ZWQsXHJcbiAgICBUZXh0dXJlLFxyXG59XHJcblxyXG5leHBvcnQgZW51bSBUZXh0dXJlQ29uY3JldGVQcmVjaXNpb24ge1xyXG4gICAgVGV4dHVyZTJEID0gMTAwLFxyXG4gICAgVGV4dHVyZUN1YmUgPSAxMDFcclxufTsgXHJcblxyXG5cclxuZXhwb3J0IGVudW0gUG9zaXRpb25TcGFjZSB7XHJcbiAgICBPYmplY3QgPSAwLFxyXG4gICAgVmlldyxcclxuICAgIFdvcmxkLFxyXG4gICAgVGFuZ2VudCxcclxuICAgIEFic29sdXRlV29ybGRcclxufVxyXG5cclxuZXhwb3J0IGVudW0gTm9ybWFsU3BhY2Uge1xyXG4gICAgT2JqZWN0ID0gMTAwLFxyXG4gICAgVmlldyxcclxuICAgIFdvcmxkLFxyXG4gICAgVGFuZ2VudCxcclxufVxyXG5cclxuZXhwb3J0IGVudW0gVmlld0RpcmVjdGlvblNwYWNlIHtcclxuICAgIE9iamVjdCA9IDIwMCxcclxuICAgIFZpZXcsXHJcbiAgICBXb3JsZCxcclxuICAgIFRhbmdlbnQsXHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBOb3JtYWxNYXBTcGFjZSA9IDMwMDtcclxuXHJcbmV4cG9ydCBjb25zdCBXb3JsZFRhbmdlbnQgPSA0MDA7XHJcbiJdfQ==