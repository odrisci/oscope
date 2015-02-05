/*! oscope v1.6.0 - 2015-02-05 
 * License:  */
'use strict';
(function(exports){
var oscope = exports.oscope = {version: "1.6.0"};
var oscope_id = 0;

function oscope_identity(d) { return d; }

oscope.option = function(name, defaultValue) {
  var values = oscope.options(name);
  return values.length ? values[0] : defaultValue;
};

oscope.options = function(name, defaultValues) {
  var options = location.search.substring(1).split("&"),
      values = [],
      i = -1,
      n = options.length,
      o;
  while (++i < n) {
    if ((o = options[i].split("="))[0] == name) {
      values.push(decodeURIComponent(o[1]));
    }
  }
  return values.length || arguments.length < 2 ? values : defaultValues;
};

oscope.modularTimeScale = function(){
  var tleft_, // the time at the left boundary of the time scale
      icurr_ = 0, // The index of the current time point in the rnage
      lscale_ = d3.time.scale(), // The scale for values 'left' of now
      rscale_ = d3.time.scale(), // The scale for values 'right' of now
                                 // essentially these are times earlier than tleft_
      scale_ = d3.time.scale(), // The nominal scale with the correct domain and range
      isModular_ = true,
      duration_;

  function scale( x ){
    if( !isModular_ ){
      return scale_(x);
    }
    if( x < tleft_ ){
      return rscale_(x);
    }

    return lscale_(x);
  }

  scale.invert = function( y ){
    if( !isModular_ ){
      return scale_.invert(y);
    }
    if( y < icurr_ ){
      return lscale_.invert(y);
    }

    return rscale_.invert(y);
  };

  scale.rescale = function(){
    var theDom = scale_.domain(),
        start = Math.min.apply( null, theDom ),
        stop = Math.max.apply( null, theDom );

    duration_ = stop - start;

    while( start > tleft_ ){
      tleft_ = +tleft_ + duration_;
    }

    while( stop <= tleft_ ){
      tleft_ -= duration_;
    }

    lscale_.domain([tleft_,+tleft_+duration_]);
    rscale_.domain([tleft_-duration_,tleft_]);

    icurr_ = rscale_( start );

    return scale;
  };

  scale.domain = function(_){
    if(!arguments.length) return scale_.domain();
    scale_.domain(_);

    return scale.rescale();
  };

  scale.range = function(_){
    if(!arguments.length) return scale_.range();
    scale_.range(_);
    lscale_.range(_);
    rscale_.range(_);
    return scale;
  };

  scale.tleft = function(_){
    if(!arguments.length) return scale_.domain();
    tleft_=_;
    return scale.rescale();
  };

  scale.nice = function(){
    var domain_ = scale_.domain();

    // This will extend the domain to give nice values for the start and end points
    scale_.nice();

    // Now we treat the nice first element of the domain as tleft_ and restore the old domain:
    scale.tleft( scale_.domain()[0] );

    return scale.domain( domain_ );
  };

  scale.isModular = function(_){
    if(!arguments.length) return scale.isModular_;
    isModular_ = _;
    return scale.rescale();
  };

  scale.copy = function(){
    var ret = oscope.modularTimeScale()
      .range( scale.range() )
      .domain( scale.domain() )
      .isModular( isModular_ )
      .tleft( tleft_ );

    return ret;
  };

  return d3.rebind( scale, scale_,
    'tickFormat',
    'ticks'
  );

};


// use a 24 hour clock on the x-axis
var oscope_timeFormat = d3.time.format.multi([
  [".%L", function(d) { return d.getMilliseconds(); }],
  [":%S", function(d) { return d.getSeconds(); }],
  ["%H:%M", function(d) { return d.getMinutes(); }],
  ["%H", function(d) { return d.getHours(); }],
  ["%a %d", function(d) { return d.getDay() && d.getDate() != 1; }],
  ["%b %d", function(d) { return d.getDate() != 1; }],
  ["%B", function(d) { return d.getMonth(); }],
  ["%Y", function() { return true; }]
]);

oscope.context = function() {
  var context = new oscope_context(),
      step = 1e4, // ten seconds, in milliseconds
      size = 1440, // four hours at ten seconds, in pixels
      duration = size*step, // duration of the window in milliseconds
      start0, stop0, // the start and stop for the previous change event
      start1, stop1, // the start and stop for the next prepare event
      serverDelay = 5e3,
      clientDelay = 5e3,
      event = d3.dispatch("prepare", "beforechange", "change", "focus", "update"),
      scale = context.scale = oscope.modularTimeScale().range([0, size]),
      type = 'sweeping',
      timeout,
      focus,
      onepx = scale.invert(1) - scale.invert(0),
      overlap = oscope_metricOverlap * step;
  function update() {
    var now = Date.now();
    stop0 = new Date(now - serverDelay - clientDelay);
    start0 = new Date(stop0 - duration);
    stop1 = new Date(now - serverDelay);
    start1 = new Date(stop1 - duration);

    scale.domain([start0,stop0]);

    if( type == 'sweeping' ){
      scale.nice();
    }

    event.update.call( context, start1, stop1 );

    return context;
  }

  context.start = function() {
    if (timeout) clearTimeout(timeout);
    var delay = +stop1 + serverDelay - Date.now();

    scale.domain([start0,stop0]);
    if( type == 'sweeping' ){
      scale.nice();
    }
    onepx = scale.invert(1) - scale.invert(0);

    // If we're too late for the first prepare event, skip it.
    if (delay < clientDelay) delay += step;

    timeout = setTimeout(function prepare() {
      stop1 = new Date(Date.now() - serverDelay - overlap);
      start1 = new Date(stop1 - duration);
      var dataStop = new Date( +stop1 + overlap );


      event.prepare.call(context, start1, dataStop);

      setTimeout(function() {
        scale.domain([start0 = start1, stop0 = stop1]);
        event.beforechange.call(context, start1, stop1);
        event.change.call(context, start1, stop1);
        event.focus.call(context, focus ? focus : context.scale(stop1-onepx) );
      }, clientDelay);

      timeout = setTimeout(prepare, step);
    }, delay);
    return context;
  };

  context.stop = function() {
    timeout = clearTimeout(timeout);
    return context;
  };

  timeout = setTimeout(context.start, 10);

  // Set or get the step interval in milliseconds.
  // Defaults to ten seconds.
  context.step = function(_) {
    if (!arguments.length) return step;
    step = +_;
    return update();
  };

  // Set or get the context size (the count of metric values).
  // Defaults to 1440 (four hours at ten seconds).
  context.size = function(_) {
    if (!arguments.length) return size;
    scale.range([0, size = +_]);
    return update();
  };

  // Set or get the context size (the count of metric values).
  // Defaults to 1440 (four hours at ten seconds).
  context.duration = function(_) {
    if (!arguments.length) return duration;
    duration = _;
    return update();
  };

  // The server delay is the amount of time we wait for the server to compute a
  // metric. This delay may result from clock skew or from delays collecting
  // metrics from various hosts. Defaults to 4 seconds.
  context.serverDelay = function(_) {
    if (!arguments.length) return serverDelay;
    serverDelay = +_;
    return update();
  };

  // The client delay is the amount of additional time we wait to fetch those
  // metrics from the server. The client and server delay combined represent the
  // age of the most recent displayed metric. Defaults to 1 second.
  context.clientDelay = function(_) {
    if (!arguments.length) return clientDelay;
    clientDelay = +_;
    return update();
  };

  // Sets the focus to the specified index, and dispatches a "focus" event.
  context.focus = function(i) {
    event.focus.call(context, focus = i);
    return context;
  };

  context.overlap = function(_){
    if(!arguments.length) return overlap;
    overlap = _;
    return context;
  };

  // set the type of the context: 'sweeping' or 'scrolling'
  context.type = function(_){
    if(!arguments.length) return type;
    if( _ != type ){
      if( _ == 'sweeping' ){
        scale.isModular( true );
        type = _;
      }
      else if( _ == 'scrolling' ){
        scale.isModular( false );
        type = _;
      }
      return update();
    }
    return context;
  };

  // Add, remove or get listeners for events.
  context.on = function(type, listener) {
    if (arguments.length < 2) return event.on(type);

    event.on(type, listener);

    // Notify the listener of the current start and stop time, as appropriate.
    // This way, metrics can make requests for data immediately,
    // and likewise the axis can display itself synchronously.
    if (listener !== null) {
      if (/^prepare(\.|$)/.test(type)) listener.call(context, start1, stop1);
      if (/^beforechange(\.|$)/.test(type)) listener.call(context, start0, stop0);
      if (/^change(\.|$)/.test(type)) listener.call(context, start0, stop0);
      if (/^focus(\.|$)/.test(type)) listener.call(context, focus);
      if (/^update(\.|$)/.test(type)) listener.call(context, update, start1, stop1 );
    }

    return context;
  };

  d3.select(window).on("keydown.context-" + ++oscope_id, function() {
    switch (!d3.event.metaKey && d3.event.keyCode) {
      case 37: // left
        if (focus === null) focus = context.scale(stop1-onepx);
        if( focus <= 0 ) focus += size;
        if (focus > 0) context.focus(--focus);
        break;
      case 39: // right
        if (focus === null) focus = context.scale(stop1-onepx)-1;
        //if (focus < size - 1) context.focus(++focus);
        ++focus;
        if( focus >= size ) focus -= size;
        break;
      default: return;
    }
    d3.event.preventDefault();
  });

  return update();
};

function oscope_context() {}

var oscope_contextPrototype = oscope.context.prototype = oscope_context.prototype;

oscope_contextPrototype.constant = function(value) {
  return new oscope_metricConstant(this, +value);
};

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
      values = new ts.timeSeries(),
      event = d3.dispatch("change"),
      listening = 0,
      fetching;

  // Prefetch new data into a temporary array.
  function prepare(start1, stop) {
    var steps = Math.min(Math.floor(duration/step), Math.round((start1 - start) / step));
    if (!steps || fetching) return; // already fetched, or fetching!
    fetching = true;
    steps = Math.min(Math.floor(duration/step), steps + oscope_metricOverlap);
    var start0 = new Date(stop - steps * step);
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
    values.dropDataBefore(start1);
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
      if( values[i].startTime < t1 && values[i].endTime > t0 ){
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


oscope_contextPrototype.oscope = function(){
  var context = this,
      buffer = document.createElement('canvas'),
      width = buffer.width = context.size(),
      height = buffer.height = 30,
      scale = d3.scale.linear(),
      metric = oscope_identity,
      extent = null,
      title = oscope_identity,
      format = d3.format('.2s'),
      colors = ["#08519c","#3182bd","#6baed6","#bdd7e7","#bae4b3","#74c476","#31a354","#006d2c"],
      barWidth = 5;

  function oscope(selection) {

    selection.append('canvas')
      .on('mousemove.oscope', function() { context.focus(Math.round(d3.mouse(this)[0])); })
      .on('mouseout.oscope', function() { context.focus(null); } )
      .attr('width', width)
      .attr('height', height);

    selection.each(function(d,i) {
      var that = this,
          id = ++oscope_id,
          metric_ = typeof metric === 'function' ? metric.call(that, d, i) : metric,
          colors_ = typeof colors === 'function' ? metric.call(that, d, i) : colors,
          extent_ = typeof extent === 'function' ? extent.call(that, d, i) : extent,
          start = -Infinity,
          step = context.step(),
          canvas = d3.select(that).select('canvas'),
          ctx0 = buffer.getContext( '2d' ),
          ctx,
          span,
          max_,
          ready,
          offset = 0,
          offsets = [0],
          numMetrics = 1,
          focusValue = [[]],
          metricIsArray = (metric_ instanceof Array);

      canvas.datum({id: id, metric: metric_});
      ctx = canvas.node().getContext('2d');

      if( metricIsArray ){
        numMetrics = metric_.length;
        if( extent_ !== null ){
          offset = (extent_[1] - extent_[0])/numMetrics;
          offsets = new Array(numMetrics);
          var k = 0;
          offsets[0] = extent_[1] - offset/2;
          for( k = 1; k < numMetrics; ++k ){
            offsets[k] = offsets[k-1] - offset;
          }
        }
        focusValue = new Array( numMetrics );
      }

      // Update the domain and range
      scale.domain(extent_);
      scale.range([height,0]); // note inversion of canvas y-axis


      span = d3.select(that).selectAll('.title')
        .data( metricIsArray ? metric_ : [metric_] )
        .enter()
          .append('span')
            .attr('class', 'title')
            .text(title);

      //if( metricIsArray ){
        span.style('top',function(d,i){
          return +canvas.style('top').replace(/px/g, '') + scale( offsets[i] ) - 17 + 'px'; } );
     // }

      span = d3.select(that).selectAll('.value')
        .data( focusValue )
        .enter()
          .append('span')
            .attr('class', 'value')
            .text(function(d){ return isNaN(d) ? null : format; });

      //if( metricIsArray ){
        span.style('top', function(d,i){
          return scale( offsets[i] ) - 17 + 'px'; } );
      //}


      function change(start1, stop){

        // Compute the new extent and ready flag
        var extent;
        if( extent_ !== null){
          extent = extent_;
        }
        else {
          extent = metric_.extent();
        }

        var max = Math.max(-extent[0], extent[1]);

        // Update the domain and range
        scale.domain(extent);
        scale.range([height,0]); // note inversion of canvas y-axis


        // Erase old data
        var t0;

        if( ready ){
          t0 = new Date( start - context.overlap());
        }
        else{
          t0 = new Date( stop - context.duration() + context.overlap() );
        }

        if( !isFinite(start) ){
          start = t0;
          ctx.clearRect(0, 0, width, height);
        }


        var xStop = (context.scale(stop));
        var xStart = ( context.scale(start) );
        var iFocus = context.scale(stop);

        var iStart = Math.round( xStart ),
            iStop = Math.round( xStop ),
            i0 = Math.round( context.scale(t0) );

        // Setup the buffer context:
        ctx0.save();
        ctx0.clearRect(0,0,width,height);


        // Handle the case of a scrolling context first:
        if( context.type() == 'scrolling' ){
          var dx = context.scale( stop ) - context.scale( start );
          var di = Math.round( dx );

          // if the x delta is less than the width then we copy
          if( di < width ){
            ctx0.clearRect( 0, 0, width, height );
            ctx0.drawImage( ctx.canvas, di, 0, i0,  height, 0, 0, i0, height );
            ctx.clearRect( 0, 0, width, height );
            ctx.drawImage( ctx0.canvas, 0, 0 );
          }
        }



        // Handle the cases of array of metrics or a single metric:
        var metricIdx = 0,
            currMetric,
            xPrev, yPrev;

        var incrementTsIdx = function(){
          xPrev = x; yPrev = y;
          tsIdx++;
          if( tsIdx < ts.length ){
            x = //Math.round(
                  context.scale(ts[tsIdx][0]);
                //);
            y = //Math.round(
                  scale(ts[tsIdx][1]+offsets[metricIdx]);
                //);
          }
        };

        var canvasUpdated = false,
            wrapAround = false;



        // Only declare the data ready when all metrics are ready:
        var metricsReady = [];

        for( metricIdx = 0; metricIdx < numMetrics; ++metricIdx ){

          if( metricIsArray ){
            currMetric = metric_[metricIdx];
            if( typeof currMetric === 'function' ){
              currMetric = currMetric.call( that, d, i );
            }
          }
          else{
            currMetric = metric_;
          }

          if( !ready ){
            metricsReady[metricIdx] = false;
          }

          // Now get some data to plot
          var ts = currMetric.getValuesInRange( t0-context.overlap(), +stop + context.overlap() ),
              lastTime = [];

          if( ts.length > 0 ){

            ctx0.save();

            metricsReady[metricIdx] = true;

            var tsIdx = 0;
            var x = context.scale(ts[tsIdx][0]),
                y = scale(ts[tsIdx][1]+offsets[metricIdx]),
                xLast = context.scale(ts[ts.length-1][0]);

            ctx0.strokeStyle = colors_[metricIdx % colors_.length];
            ctx0.lineWidth = 3;
            //ctx0.translate( ctx0.lineWidth/2, ctx0.lineWidth/2);

            // Find wraparound:
            if( x > xLast ){

              // Set the clip path to the limit
              ctx0.save();
              /*ctx0.beginPath();
              ctx0.rect( Math.floor(x), 0, width-Math.floor(x), height);

              ctx0.clip();*/

              ctx0.beginPath();
              ctx0.moveTo(x, y);

              incrementTsIdx();

              while( x > xLast ){
                ctx0.lineTo(x,y);
                /*ctx.bezierCurveTo(
                  Math.round( (xPrev + x )/2 ), yPrev,
                  Math.round( (xPrev + x )/2 ), y,
                  x, y );*/
                incrementTsIdx();
                //wrapAround = true;
              }

              if( context.scale.invert( xPrev ) > t0 ){
                wrapAround = true;
              }
              // Plot one point past the edge of the current canvas
              x += context.size();
              ctx0.lineTo(x,y);
              canvasUpdated = true;
              ctx0.stroke();
              ctx0.closePath();

              ctx0.closePath();
              ctx0.restore();

              // Go back to the previous point so that we have one point
              // off canvas when we return to the left hand edge.
              x = xPrev - context.size();
              y = yPrev;

              ctx0.moveTo(x,y);
            }

            // Set the clip path up to the stop line:
            ctx0.save();
            /*ctx0.beginPath();
            ctx0.rect( iStart-1, 0, iFocus - iStart + 2, height );
            //ctx.rect( 0, 0, iFocus, height );

            ctx0.clip();*/

            ctx0.beginPath();
            ctx0.moveTo(x, y);

            incrementTsIdx();

            while( tsIdx < ts.length ){
              ctx0.lineTo(x,y);
              /*ctx.bezierCurveTo(
                Math.round( (xPrev + x )/2 ), yPrev,
                Math.round( (xPrev + x )/2 ), y,
                x, y );*/
              incrementTsIdx();
              canvasUpdated = true;
            }

            ctx0.stroke();
            ctx0.closePath();
            ctx0.closePath();
            //ctx0.translate(-ctx0.lineWidth/2,-ctx0.lineWidth/2);
            ctx0.restore();

            // Store the last time value plotted for this metric:
            tsIdx = ts.length-1;
            while( tsIdx > 0 && ts[tsIdx][0] >= stop ){
              --tsIdx;
            }
            lastTime[metricIdx] = ts[tsIdx][0];

          }
          ctx0.restore();
        }

        ready = !metricsReady.some( function(d){ return !d; } );
        //start = Math.min.apply( null, lastTime );
        start = stop;

        // Setup the copy to the main canvas:
        ctx.save();
        if( wrapAround ){
          ctx.clearRect(i0, 0, context.size()- i0, height);
          if( canvasUpdated && i0 < context.size() ){
            ctx.drawImage( ctx0.canvas, i0, 0, context.size() - i0, height,
                        i0, 0, context.size() - i0, height );
          }
        }

        if( i0 > iStop ){
          i0 = 0;
        }

        ctx.clearRect(i0, 0, iStop - i0 + barWidth + 1, height );
        if( canvasUpdated && iStop > i0 ){
          ctx.drawImage(ctx0.canvas, i0, 0, iStop - i0, height,
                      i0, 0, iStop - i0, height );
        }

        // Where to start the blank bar on the next go around
        start = stop;

        ctx.restore();
      }

      function focus(i){
        if(i===null) i = context.scale(start-step);
        for( var j = 0; j < numMetrics; ++j ){
          if( metricIsArray ){
            focusValue[j] = metric_[j].valueAt(i);
          }
          else{
            focusValue = [metric_.valueAt(i)];
          }
        }
        span.data( focusValue )
            .text(function(d){ return isNaN(d) ? null : format(d); });
      }

      function update(start1, stop){
        start = -Infinity;
        ready = false;
      }

      // update the chart when the context changes
      context.on('change.oscope-' + id, change);
      context.on('focus.oscope-' + id, focus);
      context.on('update.oscope-' + id, update);

      // Display the first metric chagne immediately,
      // but defer subsequent updates to the canvas change
      // Note that someone still needs to listen to the metric,
      // so that it continues to update automatically
      var metricChange = function( theMetric ){
        return function( start, stop ){
          change(start, stop), focus();
          if(ready) theMetric.on('change.oscope-' + id, oscope_identity);
        };
      };

      if( metric_ instanceof Array ){
        for( var j = 0; j < metric_.length; ++j ){
          metric_[j].on('change.oscope-' + id, metricChange(metric_[j]) );
        }
      }
      else{
        metric_.on('change.oscope-' + id, metricChange(metric_) );
      }
    });
  }

  oscope.remove = function(selection) {

    selection
      .on('mousemove.oscope', null)
      .on('mouseout.oscope', null);

    selection.selectAll('canvas')
      .each(remove)
      .remove();

    selection.selectAll('.title,.value')
      .remove();

    function remove(d) {
      d.metric.on('change.oscope-' + d.id, null);
      context.on('change.oscope-' + d.id, null);
      context.on('focus.oscope-' + d.id, null);
      context.on('update.oscope-' + d.id, null);
    }
  };

  oscope.height = function(_) {
    if(!arguments.length) return height;
    height = buffer.height = _;
    return oscope;
  };

  oscope.scale = function(_) {
    if(!arguments.length) return scale;
    scale = _;
    return oscope;
  };

  oscope.extent = function(_) {
    if(!arguments.length) return scale;
    extent = _;
    return oscope;
  };

  oscope.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return oscope;
  };

  oscope.format = function(_) {
    if (!arguments.length) return format;
    format = _;
    return oscope;
  };

  oscope.barWidth = function(_) {
    if (!arguments.length) return barWidth;
    barWidth = _;
    return oscope;
  };

  oscope.colors = function(_) {
    if (!arguments.length) return colors;
    colors = _;
    return oscope;
  };

  return oscope;
};

oscope_contextPrototype.annote = function(){

  var context = this,
      height = 30,
      metric = oscope_identity,
      width = context.size();

  function annote(selection){
    selection.append( 'svg' )
      .attr('width', width)
      .attr('height', height)
      .append( 'g' )
        .on('mousemove.annote', function() {context.focus(Math.round(d3.mouse(this)[0])); })
        .on('mouseout.annote', function() { context.focus(null); } );

    selection.each( function(d,i){

      var that=this,
          id = ++oscope_id,
          svg = d3.select(that).select('svg'),
          metric_ = typeof metric === 'function' ? metric.call(that, d, i) : metric,
          lhs, rhs,
          defs = svg.append("defs");

      // Store the id and the metrics for later removal:
      svg.datum( { id: id, metric: metric_ } );

      var g = svg.select( 'g' )
        .attr( 'width', width )
        .attr( 'height', height );

      lhs = g.append( 'g' )
              .attr( 'width', width )
              .attr( 'height', height )
              .attr( 'clip-path', 'url(#clipLHS)' )
              .attr( 'class', 'annotations' );

      rhs = g.append( 'g' )
              .attr( 'width', width )
              .attr( 'height', height )
              .attr( 'clip-path', 'url(#clipRHS)' )
              .attr( 'class', 'annotations' );


      // Fix to work with Chrome: note chrome can't handle clipPath selection due to camelCase
      // It will keep adding new clipPath elements to the svg and never update the values
      // set up the clip paths:
      var clipData = [
        { id: "clipLHS",
          x: 0,
          width: width
        },
        { id: "clipRHS",
          x: width,
          width: 0
        } ];

      var clipPaths = defs.selectAll("clipPath")
        .data( clipData, function(d){ return d.id; } );

      clipPaths.enter()
        .append( "svg:clipPath" )
          .attr( 'id', function(d){ return d.id; } )
          .append('rect')
            .attr( 'y', 0 )
            .attr( 'height', height );


      function change( start1, stop ){

        var tleft = context.scale.invert(0),
            lhsAnnotations = metric_.getValuesInRange(tleft, stop),
            rhsAnnotations = metric_.getValuesInRange(start1, tleft),
            lhsRects, rhsRects,
            lhsLabels, rhsLabels,
            lscale = d3.time.scale(),
            rscale = d3.time.scale();

        lscale.domain([tleft, stop]).range([0, context.scale(stop)] );
        rscale.domain([start1, tleft]).range([context.scale(start1), width]);

        // set up the clip paths:
        clipData = [
          { id: "clipLHS",
            x: 0,
            width: context.scale(stop)
          },
          { id: "clipRHS",
            x: context.scale(start1),
            width: width - context.scale(start1)
          } ];

        clipPaths.data( clipData, function(d){ return d.id; } );

        clipPaths
          .select("rect")
            .attr("x", function(d){ return d.x; } )
            .attr("width", function(d){ return d.width; } );

        var getX = function( d, scale ){
          return scale( d.startTime );
        };

        var getWidth = function( d, scale ){
          return scale( d.endTime ) - scale( d.startTime );
        };

        lhs.datum( [lhsAnnotations] );
        rhs.datum( [rhsAnnotations] );

        lhsLabels = lhs.selectAll( "text" )
                    .data(lhsAnnotations)
                    .attr("x", function(d){ return Math.max( 0, getX(d,lscale) ); } );

        rhsLabels = rhs.selectAll( "text" )
                    .data(rhsAnnotations)
                    .attr("x", function(d){ return Math.max( 0, getX(d,rscale) ); } );


        lhsLabels.enter().append( "text" )
          .text( function(d){ return d.shortText; } )
          .attr('x', function(d){ return Math.max( 0, getX(d,lscale) );} )
          .attr('y', height/2 )
          .attr('dy', '0.5ex' )
          .attr('text-anchor', 'start' );

        rhsLabels.enter().append( "text" )
          .text( function(d){ return d.shortText; } )
          .attr('x', function(d){ return Math.max( 0, getX(d,rscale) );} )
          .attr('y', height/2 )
          .attr('dy', '0.5ex' )
          .attr('text-anchor', 'start' );

        lhsLabels.exit().remove();
        rhsLabels.exit().remove();

        lhsRects = lhs.selectAll( "rect" )
                    .data(lhsAnnotations)
                    .attr("x", function(d){ return getX(d,lscale); } )
                    .attr("width", function(d){ return getWidth(d,lscale); } );

        rhsRects = rhs.selectAll( "rect" )
                    .data(rhsAnnotations)
                    .attr("x", function(d){ return getX(d,rscale); } )
                    .attr("width", function(d){ return getWidth(d,rscale); } );


        lhsRects.enter().append( "rect" )
          .attr('x', function(d){ return getX(d,lscale);} )
          .attr('y', 0 )
          .attr('width', function(d){ return getWidth(d,lscale); } )
          .attr('height', height );

        rhsRects.enter().append( "rect" )
          .attr('x', function(d){ return getX(d,rscale);} )
          .attr('y', 0 )
          .attr('width', function(d){ return getWidth(d,rscale); } )
          .attr('height', height );

        lhsRects.exit().remove();
        rhsRects.exit().remove();

      }

      // focus does nothing for now, but would like bring up a pop-up
      // with the full text in it
      function focus(){}

      // update the chart when the context changes
      context.on('change.annote-' + id, change );
      context.on('focus.annote-' + id, focus );


      metric_.on( 'change.annote-' + id, function( start, stop ){
        change(start, stop);
        focus();
        metric_.on('change.annote-' + id, oscope_identity);
      });


    });

  }

  annote.remove = function(selection){

    selection
      .on('mousemove.annote', null )
      .on('mouseout.annote', null );

    selection.selectAll('svg')
      .each(remove)
      .remove();

    function remove(d){
      d.metric.on('change.annote-' + d.id, null );
      context.on('change.annote-' + d.id, null );
      context.on('focus.oscope-' + d.id, null );
    }
  };

  annote.height = function(_){
    if(!arguments.length) return height;
    height = _;
    return annote;
  };



  return annote;
};

oscope_contextPrototype.comparison = function() {
  var context = this,
      width = context.size(),
      height = 120,
      scale = d3.scale.linear().interpolate(d3.interpolateRound),
      primary = function(d) { return d[0]; },
      secondary = function(d) { return d[1]; },
      extent = null,
      title = oscope_identity,
      formatPrimary = oscope_comparisonPrimaryFormat,
      formatChange = oscope_comparisonChangeFormat,
      colors = ["#9ecae1", "#225b84", "#a1d99b", "#22723a"],
      strokeWidth = 1.5;

  function comparison(selection) {

    selection
        .on("mousemove.comparison", function() { context.focus(Math.round(d3.mouse(this)[0])); })
        .on("mouseout.comparison", function() { context.focus(null); });

    selection.append("canvas")
        .attr("width", width)
        .attr("height", height);

    selection.append("span")
        .attr("class", "title")
        .text(title);

    selection.append("span")
        .attr("class", "value primary");

    selection.append("span")
        .attr("class", "value change");

    selection.each(function(d, i) {
      var that = this,
          id = ++oscope_id,
          primary_ = typeof primary === "function" ? primary.call(that, d, i) : primary,
          secondary_ = typeof secondary === "function" ? secondary.call(that, d, i) : secondary,
          extent_ = typeof extent === "function" ? extent.call(that, d, i) : extent,
          div = d3.select(that),
          canvas = div.select("canvas"),
          spanPrimary = div.select(".value.primary"),
          spanChange = div.select(".value.change"),
          ready;

      canvas.datum({id: id, primary: primary_, secondary: secondary_});
      canvas = canvas.node().getContext("2d");

      function change(start, stop) {
        canvas.save();
        canvas.clearRect(0, 0, width, height);

        // update the scale
        var primaryExtent = primary_.extent(),
            secondaryExtent = secondary_.extent(),
            extent = extent_ == null ? primaryExtent : extent_;
        scale.domain(extent).range([height, 0]);
        ready = primaryExtent.concat(secondaryExtent).every(isFinite);

        // consistent overplotting
        var round = start / context.step() & 1
            ? oscope_comparisonRoundOdd
            : oscope_comparisonRoundEven;

        // positive changes
        canvas.fillStyle = colors[2];
        for (var i = 0, n = width; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 < y1) canvas.fillRect(round(i), y0, 1, y1 - y0);
        }

        // negative changes
        canvas.fillStyle = colors[0];
        for (i = 0; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 > y1) canvas.fillRect(round(i), y1, 1, y0 - y1);
        }

        // positive values
        canvas.fillStyle = colors[3];
        for (i = 0; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 <= y1) canvas.fillRect(round(i), y0, 1, strokeWidth);
        }

        // negative values
        canvas.fillStyle = colors[1];
        for (i = 0; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 > y1) canvas.fillRect(round(i), y0 - strokeWidth, 1, strokeWidth);
        }

        canvas.restore();
      }

      function focus(i) {
        if (i == null) i = width - 1;
        var valuePrimary = primary_.valueAt(i),
            valueSecondary = secondary_.valueAt(i),
            valueChange = (valuePrimary - valueSecondary) / valueSecondary;

        spanPrimary
            .datum(valuePrimary)
            .text(isNaN(valuePrimary) ? null : formatPrimary);

        spanChange
            .datum(valueChange)
            .text(isNaN(valueChange) ? null : formatChange)
            .attr("class", "value change " + (valueChange > 0 ? "positive" : valueChange < 0 ? "negative" : ""));
      }

      // Display the first primary change immediately,
      // but defer subsequent updates to the context change.
      // Note that someone still needs to listen to the metric,
      // so that it continues to update automatically.
      primary_.on("change.comparison-" + id, firstChange);
      secondary_.on("change.comparison-" + id, firstChange);
      function firstChange(start, stop) {
        change(start, stop), focus();
        if (ready) {
          primary_.on("change.comparison-" + id, oscope_identity);
          secondary_.on("change.comparison-" + id, oscope_identity);
        }
      }

      // Update the chart when the context changes.
      context.on("change.comparison-" + id, change);
      context.on("focus.comparison-" + id, focus);
    });
  }

  comparison.remove = function(selection) {

    selection
        .on("mousemove.comparison", null)
        .on("mouseout.comparison", null);

    selection.selectAll("canvas")
        .each(remove)
        .remove();

    selection.selectAll(".title,.value")
        .remove();

    function remove(d) {
      d.primary.on("change.comparison-" + d.id, null);
      d.secondary.on("change.comparison-" + d.id, null);
      context.on("change.comparison-" + d.id, null);
      context.on("focus.comparison-" + d.id, null);
    }
  };

  comparison.height = function(_) {
    if (!arguments.length) return height;
    height = +_;
    return comparison;
  };

  comparison.primary = function(_) {
    if (!arguments.length) return primary;
    primary = _;
    return comparison;
  };

  comparison.secondary = function(_) {
    if (!arguments.length) return secondary;
    secondary = _;
    return comparison;
  };

  comparison.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return comparison;
  };

  comparison.extent = function(_) {
    if (!arguments.length) return extent;
    extent = _;
    return comparison;
  };

  comparison.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return comparison;
  };

  comparison.formatPrimary = function(_) {
    if (!arguments.length) return formatPrimary;
    formatPrimary = _;
    return comparison;
  };

  comparison.formatChange = function(_) {
    if (!arguments.length) return formatChange;
    formatChange = _;
    return comparison;
  };

  comparison.colors = function(_) {
    if (!arguments.length) return colors;
    colors = _;
    return comparison;
  };

  comparison.strokeWidth = function(_) {
    if (!arguments.length) return strokeWidth;
    strokeWidth = _;
    return comparison;
  };

  return comparison;
};

var oscope_comparisonPrimaryFormat = d3.format(".2s"),
    oscope_comparisonChangeFormat = d3.format("+.0%");

function oscope_comparisonRoundEven(i) {
  return i & 0xfffffe;
}

function oscope_comparisonRoundOdd(i) {
  return ((i + 1) & 0xfffffe) - 1;
}

oscope_contextPrototype.axis = function() {
  var context = this,
      scale = context.scale,
      axis_ = d3.svg.axis().scale(scale).tickFormat(oscope_timeFormat);

  var formatDefault = context.step() < 6e4 ? oscope_axisFormatSeconds
      : context.step() < 864e5 ? oscope_axisFormatMinutes
      : oscope_axisFormatDays;
  var format = formatDefault;

  function axis(selection) {
    var id = ++oscope_id,
        tick;

    var g = selection.append("svg")
        .datum({id: id})
        .attr("width", context.size())
        .attr("height", Math.max(28, -axis.tickSize()))
      .append("g")
        .attr("transform", "translate(0," + (axis_.orient() === "top" ? 27 : 4) + ")")
        .call(axis_);

    context.on("change.axis-" + id, function() {
      g.call(axis_);
      if (!tick) tick = d3.select(g.node().appendChild(g.selectAll("text").node().cloneNode(true)))
          .style("display", "none")
          .text(null);
    });

    context.on("focus.axis-" + id, function(i) {
      if (tick) {
        if (i == null) {
          tick.style("display", "none");
          g.selectAll("text").style("fill-opacity", null);
        } else {
          tick.style("display", null).attr("x", i).text(format(scale.invert(i)));
          var dx = tick.node().getComputedTextLength() + 6;
          g.selectAll("text").style("fill-opacity", function(d) { return Math.abs(scale(d) - i) < dx ? 0 : 1; });
        }
      }
    });

  }

  axis.remove = function(selection) {

    selection.selectAll("svg")
        .each(remove)
        .remove();

    function remove(d) {
      context.on("change.axis-" + d.id, null);
      context.on("focus.axis-" + d.id, null);
    }
  };

  axis.focusFormat = function(_) {
    if (!arguments.length) return format == formatDefault ? null : _;
    format = _ == null ? formatDefault : _;
    return axis;
  };

  return d3.rebind(axis, axis_,
      "orient",
      "ticks",
      "tickSubdivide",
      "tickSize",
      "tickPadding",
      "tickFormat");
};

var oscope_axisFormatSeconds = d3.time.format("%H:%M:%S"),
    oscope_axisFormatMinutes = d3.time.format("%H:%M"),
    oscope_axisFormatDays = d3.time.format("%B %d");

oscope_contextPrototype.rule = function() {
  var context = this,
      metric = oscope_identity;

  function rule(selection) {
    var id = ++oscope_id;

    var line = selection.append("div")
        .datum({id: id})
        .attr("class", "line")
        .call(oscope_ruleStyle);

    selection.each(function(d, i) {
      var that = this,
          id = ++oscope_id,
          metric_ = typeof metric === "function" ? metric.call(that, d, i) : metric;

      if (!metric_) return;

      function change(start, stop) {
        var values = [];

        for (var i = 0, n = context.size(); i < n; ++i) {
          if (metric_.valueAt(i)) {
            values.push(i);
          }
        }

        var lines = selection.selectAll(".metric").data(values);
        lines.exit().remove();
        lines.enter().append("div").attr("class", "metric line").call(oscope_ruleStyle);
        lines.style("left", oscope_ruleLeft);
      }

      context.on("change.rule-" + id, change);
      metric_.on("change.rule-" + id, change);
    });

    context.on("focus.rule-" + id, function(i) {
      line.datum(i)
          .style("display", i == null ? "none" : null)
          .style("left", i == null ? null : oscope_ruleLeft);
    });
  }

  rule.remove = function(selection) {

    selection.selectAll(".line")
        .each(remove)
        .remove();

    function remove(d) {
      context.on("focus.rule-" + d.id, null);
    }
  };

  rule.metric = function(_) {
    if (!arguments.length) return metric;
    metric = _;
    return rule;
  };

  return rule;
};

function oscope_ruleStyle(line) {
  line
      .style("position", "absolute")
      .style("top", 0)
      .style("bottom", 0)
      .style("width", "1px")
      .style("pointer-events", "none");
}

function oscope_ruleLeft(i) {
  return i + "px";
}
})(this);