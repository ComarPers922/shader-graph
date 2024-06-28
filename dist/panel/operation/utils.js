"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrecisionName = exports.getValueConcretePrecision = exports.getValueElementStr = exports.getValueElement = exports.getFloatString = exports.getJsonObject = exports.shaderTemplatesDir = void 0;
const type_1 = require("./type");
const path_1 = __importDefault(require("path"));
exports.shaderTemplatesDir = path_1.default.join(__dirname, '../../../static/shader-templates');
function getJsonObject(str) {
    let content;
    try {
        content = JSON.parse(str);
    }
    catch (err) {
        console.error(err);
    }
    return content;
}
exports.getJsonObject = getJsonObject;
function getFloatString(value) {
    if (typeof value !== 'number') {
        return value;
    }
    let str = value + '';
    if (!str.includes('.')) {
        str += '.';
    }
    return str;
}
exports.getFloatString = getFloatString;
let ValueElements = {
    vector: ['x', 'y', 'z', 'w'],
    color: ['r', 'g', 'b', 'a'],
    mat4: ['e00', 'e01', 'e02', 'e03']
};
function getValueElement(value, index) {
    if (typeof value === 'number') {
        return value;
    }
    else if (typeof value === 'boolean') {
        return value;
    }
    let elements;
    if (value.x !== undefined) {
        elements = ValueElements.vector;
    }
    else if (value.r !== undefined) {
        elements = ValueElements.color;
    }
    else if (value.e00 !== undefined) {
        elements = ValueElements.mat4;
    }
    return value[elements[index]] || 0;
}
exports.getValueElement = getValueElement;
function getValueElementStr(value, index) {
    let val = getValueElement(value, index);
    if (typeof val === 'boolean') {
        val = val ? 1 : 0;
    }
    return getFloatString(val);
}
exports.getValueElementStr = getValueElementStr;
function getValueConcretePrecision(value) {
    let valueConretePresition = 1;
    if (typeof value === 'object') {
        if (value.w !== undefined || value.a !== undefined) {
            valueConretePresition = 4;
        }
        else if (value.z !== undefined || value.b !== undefined) {
            valueConretePresition = 3;
        }
        else if (value.y !== undefined || value.g !== undefined) {
            valueConretePresition = 2;
        }
        else if (value.m_SerializedTexture !== undefined) {
            valueConretePresition = type_1.TextureConcretePrecision.Texture2D;
        }
        else if (value.m_SerializedCubemap !== undefined) {
            valueConretePresition = type_1.TextureConcretePrecision.TextureCube;
        }
    }
    else if (typeof value === 'boolean') {
        valueConretePresition = 5;
    }
    return valueConretePresition;
}
exports.getValueConcretePrecision = getValueConcretePrecision;
function getPrecisionName(precision) {
    let name = '';
    if (precision === 1) {
        name = 'float';
    }
    else if (precision === 2) {
        name = 'vec2';
    }
    else if (precision === 3) {
        name = 'vec3';
    }
    else if (precision === 4) {
        name = 'vec4';
    }
    else if (precision === type_1.TextureConcretePrecision.Texture2D) {
        name = 'sampler2D';
    }
    else if (precision === type_1.TextureConcretePrecision.TextureCube) {
        name = 'samplerCube';
    }
    else if (precision === 5) {
        name = 'bool';
    }
    return name;
}
exports.getPrecisionName = getPrecisionName;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWwvb3BlcmF0aW9uL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGlDQUFrRDtBQUNsRCxnREFBd0I7QUFFWCxRQUFBLGtCQUFrQixHQUFHLGNBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGtDQUFrQyxDQUFDLENBQUE7QUFFMUYsU0FBZ0IsYUFBYSxDQUFFLEdBQVc7SUFDdEMsSUFBSSxPQUFPLENBQUM7SUFDWixJQUFJO1FBQ0EsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDN0I7SUFDRCxPQUFPLEdBQUcsRUFBRTtRQUNSLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDdEI7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNuQixDQUFDO0FBVEQsc0NBU0M7QUFFRCxTQUFnQixjQUFjLENBQUUsS0FBYTtJQUN6QyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtRQUMzQixPQUFPLEtBQUssQ0FBQztLQUNoQjtJQUVELElBQUksR0FBRyxHQUFHLEtBQUssR0FBRyxFQUFFLENBQUM7SUFDckIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDcEIsR0FBRyxJQUFJLEdBQUcsQ0FBQztLQUNkO0lBQ0QsT0FBTyxHQUFHLENBQUM7QUFDZixDQUFDO0FBVkQsd0NBVUM7QUFFRCxJQUFJLGFBQWEsR0FBRztJQUNoQixNQUFNLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7SUFDNUIsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO0lBQzNCLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FB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Q0ksSUFBSSxTQUFTLEtBQUssK0JBQXdCLENBQUMsU0FBUyxFQUFFO1FBQ3ZELElBQUksR0FBRyxXQUFXLENBQUM7S0FDdEI7U0FDSSxJQUFJLFNBQVMsS0FBSywrQkFBd0IsQ0FBQyxXQUFXLEVBQUU7UUFDekQsSUFBSSxHQUFHLGFBQWEsQ0FBQztLQUN4QjtTQUNJLElBQUksU0FBUyxLQUFLLENBQUMsRUFDeEI7UUFDSSxJQUFJLEdBQUcsTUFBTSxDQUFBO0tBQ2hCO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQztBQXpCRCw0Q0F5QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUZXh0dXJlQ29uY3JldGVQcmVjaXNpb24gfSBmcm9tIFwiLi90eXBlXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IGNvbnN0IHNoYWRlclRlbXBsYXRlc0RpciA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvc2hhZGVyLXRlbXBsYXRlcycpXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0SnNvbk9iamVjdCAoc3RyOiBzdHJpbmcpIHtcclxuICAgIGxldCBjb250ZW50O1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb250ZW50ID0gSlNPTi5wYXJzZShzdHIpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcclxuICAgIH1cclxuICAgIHJldHVybiBjb250ZW50O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmxvYXRTdHJpbmcgKHZhbHVlOiBudW1iZXIpIHtcclxuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBzdHIgPSB2YWx1ZSArICcnO1xyXG4gICAgaWYgKCFzdHIuaW5jbHVkZXMoJy4nKSkge1xyXG4gICAgICAgIHN0ciArPSAnLic7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gc3RyO1xyXG59XHJcblxyXG5sZXQgVmFsdWVFbGVtZW50cyA9IHtcclxuICAgIHZlY3RvcjogWyd4JywgJ3knLCAneicsICd3J10sXHJcbiAgICBjb2xvcjogWydyJywgJ2cnLCAnYicsICdhJ10sXHJcbiAgICBtYXQ0OiBbJ2UwMCcsICdlMDEnLCAnZTAyJywgJ2UwMyddXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRWYWx1ZUVsZW1lbnQgKHZhbHVlOiBhbnkgfCBudW1iZXIsIGluZGV4OiBudW1iZXIpOiBudW1iZXIgfCBib29sZWFuIHtcclxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpe1xyXG4gICAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgfVxyXG5cclxuICAgIGxldCBlbGVtZW50cztcclxuXHJcbiAgICBpZiAodmFsdWUueCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgZWxlbWVudHMgPSBWYWx1ZUVsZW1lbnRzLnZlY3RvcjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHZhbHVlLnIgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIGVsZW1lbnRzID0gVmFsdWVFbGVtZW50cy5jb2xvcjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHZhbHVlLmUwMCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgZWxlbWVudHMgPSBWYWx1ZUVsZW1lbnRzLm1hdDQ7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHZhbHVlW2VsZW1lbnRzW2luZGV4XV0gfHwgMDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFZhbHVlRWxlbWVudFN0cih2YWx1ZTogb2JqZWN0IHwgbnVtYmVyLCBpbmRleDogbnVtYmVyKTogc3RyaW5nIHtcclxuICAgIGxldCB2YWwgPSBnZXRWYWx1ZUVsZW1lbnQodmFsdWUsIGluZGV4KVxyXG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdib29sZWFuJylcclxuICAgIHtcclxuICAgICAgICB2YWwgPSB2YWwgPyAxIDogMFxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGdldEZsb2F0U3RyaW5nKHZhbCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRWYWx1ZUNvbmNyZXRlUHJlY2lzaW9uICh2YWx1ZSkge1xyXG4gICAgbGV0IHZhbHVlQ29ucmV0ZVByZXNpdGlvbiA9IDE7XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIGlmICh2YWx1ZS53ICE9PSB1bmRlZmluZWQgfHwgdmFsdWUuYSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHZhbHVlQ29ucmV0ZVByZXNpdGlvbiA9IDQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHZhbHVlLnogIT09IHVuZGVmaW5lZCB8fCB2YWx1ZS5iICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdmFsdWVDb25yZXRlUHJlc2l0aW9uID0gMztcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodmFsdWUueSAhPT0gdW5kZWZpbmVkIHx8IHZhbHVlLmcgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB2YWx1ZUNvbnJldGVQcmVzaXRpb24gPSAyO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh2YWx1ZS5tX1NlcmlhbGl6ZWRUZXh0dXJlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdmFsdWVDb25yZXRlUHJlc2l0aW9uID0gVGV4dHVyZUNvbmNyZXRlUHJlY2lzaW9uLlRleHR1cmUyRDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodmFsdWUubV9TZXJpYWxpemVkQ3ViZW1hcCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHZhbHVlQ29ucmV0ZVByZXNpdGlvbiA9IFRleHR1cmVDb25jcmV0ZVByZWNpc2lvbi5UZXh0dXJlQ3ViZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJylcclxuICAgIHtcclxuICAgICAgICB2YWx1ZUNvbnJldGVQcmVzaXRpb24gPSA1XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWVDb25yZXRlUHJlc2l0aW9uO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJlY2lzaW9uTmFtZSAocHJlY2lzaW9uOiBudW1iZXIpIHtcclxuICAgIGxldCBuYW1lID0gJyc7XHJcbiAgICBpZiAocHJlY2lzaW9uID09PSAxKSB7XHJcbiAgICAgICAgbmFtZSA9ICdmbG9hdCc7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChwcmVjaXNpb24gPT09IDIpIHtcclxuICAgICAgICBuYW1lID0gJ3ZlYzInO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAocHJlY2lzaW9uID09PSAzKSB7XHJcbiAgICAgICAgbmFtZSA9ICd2ZWMzJztcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHByZWNpc2lvbiA9PT0gNCkge1xyXG4gICAgICAgIG5hbWUgPSAndmVjNCc7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChwcmVjaXNpb24gPT09IFRleHR1cmVDb25jcmV0ZVByZWNpc2lvbi5UZXh0dXJlMkQpIHtcclxuICAgICAgICBuYW1lID0gJ3NhbXBsZXIyRCc7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChwcmVjaXNpb24gPT09IFRleHR1cmVDb25jcmV0ZVByZWNpc2lvbi5UZXh0dXJlQ3ViZSkge1xyXG4gICAgICAgIG5hbWUgPSAnc2FtcGxlckN1YmUnO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAocHJlY2lzaW9uID09PSA1KVxyXG4gICAge1xyXG4gICAgICAgIG5hbWUgPSAnYm9vbCdcclxuICAgIH1cclxuICAgIHJldHVybiBuYW1lO1xyXG59XHJcbiJdfQ==