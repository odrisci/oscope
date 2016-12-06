oscope.passive_context = function(){
  var context = new oscope_context(),
      step = 1e4, // ten seconds, in milliseconds
      size = 1440, // four hours at ten seconds, in pixels
      duration = size*step, // duration of the window in milliseconds
      start0, stop0, // the start and stop for the previous change event
      start1, stop1, // the start and stop for the next prepare event
      event = d3.dispatch("prepare", "beforechange", "change", "focus", "update"),
      scale = context.scale = d3.time.scale().range([0, size]),
      type = 'passive',
      focus,
      id = ++oscope_id,
      onepx = scale.invert(1) - scale.invert(0),
      overlap = oscope_metricOverlap * step;
  function update() {
    onepx = duration/size;

    start0 = scale.invert(0);
    stop0 = scale.invert(size);

    event.update.call( context, start0, stop0 );

    setTimeout( change, 0 );

    return change();
  }

  function change(){

    start1 = scale.invert(0);
    stop1 = scale.invert(size);
    var dataStop = new Date( +stop1 + overlap );

    event.prepare.call( context, start1, dataStop );

    setTimeout( function(){
      event.beforechange.call(context, start1, stop1 );
      event.change.call( context, start1, stop1 );
      event.focus.call( context, focus ? focus : context.scale( stop1-onepx ) );

      start0 = start1; stop0 = stop1;
    }, 1 );

    return context;
  }


  // Set or get the step interval in milliseconds.
  // Defaults to ten seconds.
  context.step = function(_) {
    if (!arguments.length) return step;
    step = +_;
    return context;
  };

  context.type = function(){
    if(!arguments.length) return 'passive';
    throw new Error( 'Unable to configure context type in passive_context' );
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

  context.start = function(_){
    if(!arguments.length) return start0;
    start0 = new Date( _ );
    stop0 = new Date( +start0 + duration );
    scale.domain( [start0, stop0 ] );
    return change();
  };

  context.stop = function(_){
    if(!arguments.length) return stop0;
    stop0 = new Date(_);
    start0 = new Date( +stop0 - duration );
    scale.domain( [start0, stop0 ] );
    return change();
  };

  context.pan = function(){
    var dx = d3.event.dx;
    if( d3.event.type === 'wheel' ){
      var wdx = d3.event.wheelDeltaX;
      var wdy = d3.event.wheelDeltaY;
      if( Math.abs( wdx ) > Math.abs( wdy ) ){
        dx = wdx;
      }
      else{
        dx = wdy;
      }
    }
    var newDomain = [ scale.invert( scale.range()[0] - dx ),
      scale.invert( scale.range()[1]  - dx ) ];
    scale.domain( newDomain );
    return change();
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

  d3.select(window).on("keydown.context-" + id, function() {
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

  stop0 = Date.now();

  update();
  change();
  return context;
};

