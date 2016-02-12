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
      scale.nice(1);
    }

    onepx = duration/size;

    event.update.call( context, start1, stop1 );

    return context;
  }

  context.start = function() {
    if (timeout) clearTimeout(timeout);
    var delay = +stop1 + serverDelay - Date.now();

    scale.domain([start0,stop0]);
    if( type == 'sweeping' ){
      scale.nice(1);
    }
    onepx = scale.invert(1) - scale.invert(0);

    // If we're too late for the first prepare event, skip it.
    if (delay < clientDelay) delay += step;

    timeout = setTimeout(function prepare() {
      stop1 = new Date(Date.now() - serverDelay );
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
