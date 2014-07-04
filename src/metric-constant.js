function oscope_metricConstant(context, value) {
  oscope_metric.call(this, context);
  value = +value;
  var name = value + "";
  this.valueOf = function() { return value; };
  this.toString = function() { return name; };
}

var oscope_metricConstantPrototype = oscope_metricConstant.prototype = Object.create(oscope_metric.prototype);

oscope_metricConstantPrototype.valueAt = function() {
  return +this;
};

oscope_metricConstantPrototype.extent = function() {
  return [+this, +this];
};
