function oscope_metricOperator(name, operate) {

  function oscope_metricOperator(left, right) {
    if (!(right instanceof oscope_metric)) right = new oscope_metricConstant(left.context, right);
    else if (left.context !== right.context) throw new Error("mismatch context");
    oscope_metric.call(this, left.context);
    this.left = left;
    this.right = right;
    this.toString = function() { return left + " " + name + " " + right; };
  }

  var oscope_metricOperatorPrototype = oscope_metricOperator.prototype = Object.create(oscope_metric.prototype);

  oscope_metricOperatorPrototype.valueAt = function(i) {
    return operate(this.left.valueAt(i), this.right.valueAt(i));
  };

  oscope_metricOperatorPrototype.shift = function(offset) {
    return new oscope_metricOperator(this.left.shift(offset), this.right.shift(offset));
  };

  oscope_metricOperatorPrototype.on = function(type, listener) {
    if (arguments.length < 2) return this.left.on(type);
    this.left.on(type, listener);
    this.right.on(type, listener);
    return this;
  };

  return function(right) {
    return new oscope_metricOperator(this, right);
  };
}

oscope_metricPrototype.add = oscope_metricOperator("+", function(left, right) {
  return left + right;
});

oscope_metricPrototype.subtract = oscope_metricOperator("-", function(left, right) {
  return left - right;
});

oscope_metricPrototype.multiply = oscope_metricOperator("*", function(left, right) {
  return left * right;
});

oscope_metricPrototype.divide = oscope_metricOperator("/", function(left, right) {
  return left / right;
});
