function oscope_metric(context) {
  if (!(context instanceof oscope_context)) throw new Error("invalid context");
  this.context = context;
}

var oscope_metricPrototype = oscope_metric.prototype;

oscope.metric = oscope_metric;

oscope_metricPrototype.valueAt = function() {
  return NaN;
};

oscope_metricPrototype.getValuesInRange = function() {
  return [];
};

oscope_metricPrototype.alias = function(name) {
  this.toString = function() { return name; };
  return this;
};

oscope_metricPrototype.extent = function() {
  var i = 0,
      value,
      min = Infinity,
      max = -Infinity,
      dom = this.context.scale.domain(),
      theTS = values.getValuesInRange( dom[0], dom[1] ),
      n = theTS.length;
  while (++i < n) {
    value = theTS[i][1];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
};

oscope_metricPrototype.on = function(type, listener) {
  return arguments.length < 2 ? null : this;
};

oscope_metricPrototype.shift = function() {
  return this;
};

oscope_metricPrototype.on = function() {
  return arguments.length < 2 ? null : this;
};

oscope_contextPrototype.metric = function(request, name) {
  var context = this,
      metric = new oscope_metric(context),
      id = ".metric-" + ++oscope_id,
      start = -Infinity,
      stop,
      step = context.step(),
      size = context.size(),
      duration = context.duration(),
      history = duration,
      values = new ts.timeSeries(),
      event = d3.dispatch("change"),
      listening = 0,
      fetching;

  // Prefetch new data into a temporary array.
  function prepare(start1, stop) {
    if( fetching ) return;
    fetching = true;
    var start0 = start1, origData=values.data();
    values = new ts.timeSeries();

    request(start0, stop, step, function(error, data) {
      fetching = false;
      if (error) return console.warn(error);
      values.splice(data);
      event.change.call(metric, start, stop);
    });
  }

  // When the context changes, switch to the new data, ready-or-not!
  function beforechange(start1, stop1) {
    if (!isFinite(start)) start = start1;
    if( +start1 < +start ){
      values = new ts.timeSeries();
    }
    values.dropDataBefore( new Date( +stop1 - history ) );
    start = start1;
    stop = stop1;
  }

  //
  metric.valueAt = function(i) {
    var t = context.scale.invert(i);

    return values.getValueNearest(t)[1];
  };

  metric.getValuesInRange = function( t0, t1 ){
    return values.getValuesInRange(t0, t1);
  };

  //
  metric.shift = function(offset) {
    return context.metric(oscope_metricShift(request, +offset));
  };

  //
  metric.on = function(type, listener) {
    if (!arguments.length) return event.on(type);

    // If there are no listeners, then stop listening to the context,
    // and avoid unnecessary fetches.
    if (listener === null) {
      if (event.on(type) != null && --listening == 0) {
        context.on("prepare" + id, null).on("beforechange" + id, null);
      }
    } else {
      if (event.on(type) == null && ++listening == 1) {
        context.on("prepare" + id, prepare).on("beforechange" + id, beforechange);
      }
    }

    event.on(type, listener);

    // Notify the listener of the current start and stop time, as appropriate.
    // This way, charts can display synchronous metrics immediately.
    if (listener !== null) {
      if (/^change(\.|$)/.test(type)) listener.call(context, start, stop);
    }

    return metric;
  };

  //
  if (arguments.length > 1) metric.toString = function() {
    return name;
  };

  metric.history = function(_){
    if( !arguments.length ) return history;
    history = _;
    return metric;
  };

  return metric;
};

// Number of metric to refetch each period, in case of lag.
var oscope_metricOverlap = 6;

// Wraps the specified request implementation, and shifts time by the given offset.
function oscope_metricShift(request, offset) {
  return function(start, stop, step, callback) {
    request(new Date(+start + offset), new Date(+stop + offset), step, callback);
  };
}
