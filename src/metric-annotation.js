function oscope_metricAnnotation( context ){
  oscope_metric.call( this, context );
}

var oscope_metricAnnotationPrototype = oscope_metricAnnotation.prototype = Object.create(oscope_metric.prototype);

oscope.metricAnnotation = oscope_metricAnnotation;

oscope_contextPrototype.annotation = function(request, name) {
  var context = this,
      annotation = new oscope_metricAnnotation(context),
      id = ".annotation-" + ++oscope_id,
      listening = 0,
      fetching,
      event = d3.dispatch("change"),
      values = [];

  function prepare(start1, stop) {
    if( fetching ) return;
    fetching = true;

    request( start1, stop, function( error, data ){
      fetching = false;
      if(error) return console.warn(error);
      // Just keep growing the array
      // we usually expect a relatively low number of annotations
      values = data;
      event.change.call(annotation, start1, stop);

    });

  }

  function beforechange(start1, stop1){}

  annotation.valueAt = function(i){
    var t = context.scale.invert(i),
        len = values.length;

    for( var i = 0; i < len; ++i ){
      if( values[i].startTime < t && values[i].endTime > t ){
        return values[i];
      }
    }

    return null;
  };

  annotation.getValuesInRange = function( t0, t1 ){
    var len = values.length,
        ret = [];

    for( var i = 0; i < len; ++i ){
      if( +values[i].startTime < +t1 && +values[i].endTime > +t0 ){
        ret.push( values[i] );
      }
    }

    return ret;
  };

  annotation.shift = function( offset ){
    return context.annotation(oscope_metricShift(request, +offset));
  };

  annotation.on = function(type, listener){
    if(!arguments.length) return event.on(type);

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
    //if (listener !== null) {
    //  if (/^change(\.|$)/.test(type)) listener.call(context, start, stop);
    // }

    return annotation;
  };

  if( arguments.length > 1 ) annotation.toString = function(){
    return name;
  };

  return annotation;


};
