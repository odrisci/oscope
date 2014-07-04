
oscope_contextPrototype.oscope = function(){
  var context = this,
      buffer = document.createElement('canvas'),
      width = buffer.width = context.size(),
      height = buffer.height = 30,
      scale = d3.scale.linear().interpolate(d3.interpolateRound),
      metric = oscope_identity,
      extent = null,
      title = oscope_identity,
      format = d3.format('.2s'),
      colors = ["#08519c","#3182bd","#6baed6","#bdd7e7","#bae4b3","#74c476","#31a354","#006d2c"];
      barWidth = 5;

  function oscope(selection) {

    selection
      .on('mousemove.oscope', function() { context.focus(Math.round(d3.mouse(this)[0])); })
      .on('mouseout.oscope', function() { context.focus(null); } );

    selection.append('canvas')
      .attr('width', width)
      .attr('height', height);

    selection.append('span')
      .attr('class', 'title')
      .text(title);

    selection.append('span')
      .attr('class', 'value');

    selection.each(function(d,i) {
      var that = this,
          id = ++oscope_id,
          metric_ = typeof metric === 'function' ? metric.call(that, d, i) : metric,
          colors_ = typeof colors === 'function' ? metric.call(that, d, i) : colors,
          extent_ = typeof extent === 'function' ? extent.call(that, d, i) : extent,
          start = -Infinity,
          step = context.step(),
          canvas = d3.select(that).select('canvas'),
          span = d3.select(that).select('.value'),
          max_,
          ready;

      canvas.datum({id: id, metric: metric_});
      canvas = canvas.node().getContext('2d');

      function change(start1, stop){
        canvas.save();

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
        if( !isFinite(start) ){
          start = start1;
        }

        var t0 = new Date( start - context.overlap()*step);
        var i0 = Math.round(context.scale(t0));
        var iStop = Math.round(context.scale(stop));
        var iStart = Math.round(context.scale(start));

        if( iStart > iStop ){
          canvas.clearRect(iStart, 0, context.size()- iStart, height);
          iStart = 0;
        }

        canvas.clearRect(iStart, 0, iStop - iStart + barWidth, height );

        // Where to start the blank bar on the next go around
        start = stop;

        // Now get some data to plot
        var ts = metric_.getValuesInRange( t0, stop );

        if( ts.length > 0 ){

          ready = true;

          var tsIdx = 0;
          var x = context.scale(ts[tsIdx][0]),
              y = scale(ts[tsIdx][1]),
              xLast = context.scale(ts[ts.length-1][0]);

          var incrementTsIdx = function(){
            tsIdx++;
            if( tsIdx < ts.length ){
              x = context.scale(ts[tsIdx][0]);
              y = scale(ts[tsIdx][1]);
            }
          };

          canvas.beginPath();
          canvas.strokeStyle = colors_[0];
          canvas.lineWidth = 1;

          canvas.moveTo(x, y);

          // Find wraparound:
          if( x > xLast ){
            while( x > xLast ){
              canvas.lineTo(x,y);
              incrementTsIdx();
            }

            canvas.moveTo(x,y);
          }

          incrementTsIdx();

          while( tsIdx < ts.length ){
            canvas.lineTo(x,y);
            incrementTsIdx();
          }

          canvas.stroke();

        }

        canvas.restore();
      }

      function focus(i){
        if(i===null) i = context.scale(start-step);
        var value = metric_.valueAt(i);
        if( value !== undefined ){
          span.datum(value).text(isNaN(value) || value.length === 0 ? null : format);
        }
      }

      // update the chart when the context changes
      context.on('change.oscope-' + id, change);
      context.on('focus.oscope-' + id, focus);

      // Display the first metric chagne immediately,
      // but defer subsequent updates to the canvas change
      // Note that someone still needs to listen to the metric,
      // so that it continues to update automatically
      metric_.on('change.oscope-' + id, function(start, stop){
        change(start, stop), focus();
        if(ready) metric_.on('change.oscope-' + id, oscope_identity);
      });
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
    }
  };

  oscope.height = function(_) {
    if(!arguments.length) return height;
    height = _;
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
