
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
      lineWidth = 1,
      barWidth = 5,
      zoom = d3.behavior.zoom();

  function oscope(selection) {

    selection.append('canvas')
      .on('mousemove.oscope', function() { context.focus(Math.round(d3.mouse(this)[0])); })
      .on('mouseout.oscope', function() { context.focus(null); } )
      .call( zoom.on( 'zoom', function pan(){
        context.pan();
      }))
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
          devicePixelRatio = window.devicePixelRatio || 1,
          backingStoreRatio = ctx0.webkitBackingStorePixelRatio ||
                              ctx0.mozBackingStorePixelRatio ||
                              ctx0.msBackingStorePixelRatio ||
                              ctx0.oBackingStorePixelRatio ||
                              ctx0.backingStorePixelRatio || 1,
          ratio = devicePixelRatio / backingStoreRatio,
          span,
          max_,
          ready,
          offset = 0,
          offsets = [0],
          numMetrics = 1,
          focusValue = [[]],
          earliestStartTime = Infinity,
          metricIsArray = (metric_ instanceof Array);

      canvas.datum({id: id, metric: metric_});
      canvas.width = width*ratio;
      canvas.height = height * ratio;
      buffer.width = width*ratio;
      buffer.height = height * ratio;

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
        var barDuration = ( context.type() == 'scrolling' ? 0 :
                            barWidth*( context.duration()/width ) );
        if( ready && start < stop ){
          t0 = new Date( start - context.overlap());
        }
        else{
          t0 = new Date( stop - context.duration() + barDuration );
        }

        t0 = new Date( Math.max( +t0, stop - context.duration() ) );

        if( !isFinite(start) || start > stop ){
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
          var dx = xStop - xStart;
          var di = Math.round( dx );

          // if the x delta is less than the width then we copy
          if( di > 0 && di < width ){
            ctx0.clearRect( 0, 0, width, height );
            ctx0.drawImage( ctx.canvas, di, 0, iStart,  height, 0, 0, iStart, height );
            ctx.clearRect( 0, 0, width, height );
            ctx.drawImage( ctx0.canvas, 0, 0 );
            start = context.scale.invert( xStart + di );
          }

          if( di >= width ){
            start = stop;
          }
        }
        else{
          start = stop;
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
          var ts = currMetric.getValuesInRange( t0-context.overlap(),
            +stop + context.overlap() ),
              lastTime = [];

          if( ts.length > 0 ){

            ctx0.save();

            metricsReady[metricIdx] = true;

            var tsIdx = 0;
            var x = context.scale(ts[tsIdx][0]),
                y = scale(ts[tsIdx][1]+offsets[metricIdx]),
                xLast = context.scale(ts[ts.length-1][0]);

            ctx0.strokeStyle = colors_[metricIdx % colors_.length];
            ctx0.lineWidth = lineWidth;
            //ctx0.translate( ctx0.lineWidth/2, ctx0.lineWidth/2);

            // By setting metricsReady to false we force a refresh of the whole
            // plot whenever we get data older than data we previously plotted.
            if( earliestStartTime > ts[tsIdx][0] ){
              earliestStartTime = ts[tsIdx][0];
              metricsReady[metricIdx] = false;
            }


            // Find wraparound:
            if( x > xStop ){

              // Set the clip path to the limit
              ctx0.save();
              /*ctx0.beginPath();
              ctx0.rect( Math.floor(x), 0, width-Math.floor(x), height);

              ctx0.clip();*/

              ctx0.moveTo(x, y);
              ctx0.beginPath();

              incrementTsIdx();

              while( x > xStop && tsIdx < ts.length ){
                ctx0.lineTo(x,y);
                /*ctx.bezierCurveTo(
                  Math.round( (xPrev + x )/2 ), yPrev,
                  Math.round( (xPrev + x )/2 ), y,
                  x, y );*/
                incrementTsIdx();
                //wrapAround = true;
                canvasUpdated = true;
              }

              if( tsIdx < ts.length ){
                wrapAround = true;
                // Plot one point past the edge of the current canvas
                x += context.size();
                ctx0.lineTo(x,y);
                canvasUpdated = true;
              }
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

            while( x < xStop + barWidth && tsIdx < ts.length ){
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

        // Setup the copy to the main canvas:
        if( i0 > iStop ){
          ctx.clearRect(i0, 0, context.size()- i0, height);
          if( canvasUpdated && i0 < context.size() ){
            ctx.drawImage( ctx0.canvas, i0, 0, context.size() - i0, height,
                        i0, 0, context.size() - i0, height );
          }

          i0 = 0;
        }


        ctx.clearRect(i0, 0, iStop - i0 + barWidth + 1, height );
        if( canvasUpdated && i0 > 0 && iStop > i0 ){
          var maxW = Math.min( iStop-i0, width );
          ctx.drawImage(ctx0.canvas, i0, 0, maxW, height,
                      i0, 0, maxW, height );
        }


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
    if(!arguments.length) return extent;
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

  oscope.lineWidth = function(_) {
    if (!arguments.length) return lineWidth;
    lineWidth = _;
    return oscope;
  };

  return oscope;
};
