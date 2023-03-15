var dicomParser = {
    "parseDicom":function() {}
};
function Stats() {}
function oninvalid() {}

var dat = {
    "GUI": function() {}
};

var d3 = {
    "select": function() {},
    "selectAll": function() {},
    "data": function() {},
    "enter": function() {},
    "attr": function() {},
    "on": function() {},
    "scaleBand": function() {},
    "scaleLinear": function() {},
    "bandwidth": function() {},
    "domain": function() {},
    "range": function() {},
    "paddingInner": function() {},
    "min": function() {},
    "max": function() {},
    "nodes": function() {},
    "classed": function() {},
};

dat.GUI.prototype = {
    "addFolder": function() {},
    "autoPlace":0,
    "listen": function() {}

};

V5TrackballControl.prototype = {
    "handleResize": function() {},
};

FileVolumeLoader.prototype = {
    "parseFrame":function() {}
};


// Источник: https://chromium.googlesource.com/chromium/src.git/+/72.0.3626.80/third_party/closure_compiler/externs/pending.js?autodive=0%2F%2F%2F%2F%2F%2F
/**
 * @see https://wicg.github.io/ResizeObserver/#resizeobserverentry
 * @typedef {{contentRect: DOMRectReadOnly,
 *            target: Element}}
 * TODO(scottchen): Remove this once it is added to Closure Compiler itself.
 */
let ResizeObserverEntry;
/**
 * @see https://wicg.github.io/ResizeObserver/#api
 * TODO(scottchen): Remove this once it is added to Closure Compiler itself.
 */
class ResizeObserver {
  /**
   * @param {!function(Array<ResizeObserverEntry>, ResizeObserver)} callback
   */
  constructor(callback) {}
  disconnect() {}
  /** @param {Element} target */
  observe(target) {}
  /** @param {Element} target */
  unobserve(target) {}
}


