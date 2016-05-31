
oscope_contextPrototype.chart = function(){
  var context = this,
      buffer= document.createElement('canvas'),
      bufferLeft = document.createElement('canvas'),
      bufferRight = document.createElement('canvas'),
      width = context.size(),
      bufferWidth = buffer.width = bufferLeft.width = bufferRight.width = 4*width,
      height = buffer.height = bufferLeft.height = bufferRight.height = 30,
      scale = d3.scale.linear(),
      duration = context.duration(),
      bufferDuration = duration*bufferWidth/width,
      bufferScale = d3.time.scale().range([0, bufferWidth]),
      metric = oscope_identity,
      extent = null,
      title = oscope_identity,
      format = d3.format('.2s'),
      colors = ["#08519c","#3182bd","#6baed6","#bdd7e7","#bae4b3","#74c476","#31a354","#006d2c"],
      lineWidth = 1,
      drag = d3.behavior.drag();

  function chart(selection) {

    selection.append('canvas')
      .on('mousemove.chart', function() { context.focus(Math.round(d3.mouse(this)[0])); })
      .on('mouseout.chart', function() { context.focus(null); } )
      .call( drag.on( 'drag', function pan(){
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
          ctxL = bufferLeft.getContext( '2d' ),
          ctxR = bufferRight.getContext( '2d' ),
          ctx,
          tStartView, tEndView,
          tStartBuffer, tEndBuffer,
          tStartBufferLeft, tEndBufferLeft,
          tStartBufferRight, tEndBufferRight,
          bufferLoaded = false,
          bufferLeftLoaded = false,
          bufferRightLoaded = false,
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
      buffer.width = bufferWidth*ratio;
      buffer.height = height * ratio;
      bufferLeft.width = bufferWidth*ratio;
      bufferLeft.height = height * ratio;
      bufferRight.width = bufferWidth*ratio;
      bufferRight.height = height * ratio;

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
        // This is a data change:
        // Ensure that the view hasn't updated:
        if( tStartView !== start1 || tEndView !== stop ){
          update( start1, stop );
        }

        // Now we simply copy from the centre buffer out to the view:

        if( !bufferLoaded ){
          drawToBuffer(0);
        }
        bufferScale.domain( [tStartBuffer, tEndBuffer] );

        ctx.save();
        ctx.clearRect(0, 0, width, height);
        var x0 = Math.round( bufferScale( tStartView ) );
        ctx.drawImage( ctx0.canvas, x0, 0, width, height,
          0, 0, width, height );
        //ctx.drawImage( ctx0.canvas, 0, 0, bufferWidth, height,
          //0, 0, width, height );
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
        // We need to set the view  here
        // Now check if the buffers need updating:
        //
        // Check if the width or heights have changed and update
        // accordingly
        //
        tStartView = start1; tEndView = stop;

      }

      function drawToBuffer( bufInd ){
        // Do the actual plotting onto the canvas indicated by bufInd
        //  -1 == bufferLeft
        //  0  == buffer
        //  1  == bufferRight
        var theCtx, tLeft, tRight;

        switch( bufInd ){
          case -1:
            theCtx = ctxL;
            tLeft = tStartBufferLeft;
            tRight = tEndBufferLeft;
            bufferLeftLoaded = true;
            break;
          case 0:
            theCtx = ctx0;
            tLeft = tStartBuffer;
            tRight = tEndBuffer;
            bufferLoaded = true;
            break;
          case 1:
            theCtx = ctxR;
            tLeft = tStartBufferRight;
            tRight = tEndBufferRight;
            bufferRightLoaded = true;
            break;
          default:
            throw new Error( 'Invalid buffer index' );
        }
        var extent;

        if( extent_ !== null ){
          extent = extent_;
        }
        else{
          extent = metric_.extent();
        }

        scale.domain(extent);
        bufferScale.domain( [tLeft, tRight] ).range( [0, bufferWidth] );

        // Now get the metrics and plot:
        // Setup the buffer context:
        theCtx.save();
        theCtx.clearRect(0,0,bufferWidth,height);
        var metricIdx;
        var currMetric;
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

          // Now get some data to plot
          var ts = currMetric.getValuesInRange( +tLeft-context.overlap(),
            +tRight + context.overlap() );

          if( ts.length > 0 ){

            theCtx.save();

            var tsIdx = 0;
            var x = bufferScale(ts[tsIdx][0]),
                y = scale(ts[tsIdx][1]+offsets[metricIdx]);

            theCtx.strokeStyle = colors_[metricIdx % colors_.length];
            theCtx.lineWidth = lineWidth;

            // Set the clip path to the limit
            theCtx.beginPath();
            theCtx.moveTo(x, y);

            for( tsIdx =1; tsIdx < ts.length; ++tsIdx ){

              x = bufferScale(ts[tsIdx][0]);
              y = scale(ts[tsIdx][1]+offsets[metricIdx]);

              theCtx.lineTo(x,y);
            }
            theCtx.stroke();
            theCtx.closePath();

            theCtx.restore();

          }

          theCtx.restore();
        }


      }

      function initBuffers( start, stop ){

        var duration = context.duration();
        var bufferDuration = duration*bufferWidth/width;
        var midPoint = +start + duration/2;

        tStartView = start; tStartView = stop;

        tStartBuffer = new Date( +midPoint - bufferDuration/2 );
        tEndBuffer = new Date( +midPoint + bufferDuration/2 );
        bufferLoaded = false;

        tEndBufferLeft = new Date( +tStartBuffer + duration );
        tStartBufferLeft = new Date( +tEndBufferLeft - bufferDuration );
        bufferLeftLoaded = false;

        tStartBufferRight = new Date( +tEndBuffer - duration );
        tEndBufferRight = new Date( +tStartBufferRight + bufferDuration );
        bufferLeftLoaded = false;
      }

      function rotateBuffers( leftOrRight ){
        // Rotate the buffers either left or right:
        //
        var tmp1, tmp2;
        // left: new left buffer = old right buffer -> loaded = false
        //       new centre buffer = old left buffer -> loaded = (old
        //       left loaded)
        //       new right buffer = old centre buffer -> loaded = (old
        //       centre loaded)
        if( leftOrRight === 'left' ){

          tmp1 = bufferLeft;
          tmp2 = buffer;
          bufferLeft = bufferRight;
          buffer = tmp1;
          bufferRight = tmp2;

          tmp1 = ctxL;
          tmp2 = ctx0;
          ctxL = ctxR;
          ctx0 = tmp1;
          ctxR = tmp2;

          tmp1 = bufferLeftLoaded;
          tmp2 = bufferLoaded;
          bufferLeftLoaded = false;
          bufferLoaded = tmp1;
          bufferRightLoaded = tmp2;

          tmp1 = tStartBufferLeft;
          tmp2 = tStartBuffer;
          tStartBufferLeft = new Date( +tmp1 - bufferDuration + duration );
          tStartBuffer = tmp1;
          tStartBufferRight = tmp2;

          tEndBufferLeft = new Date( +tStartBufferLeft + bufferDuration );
          tEndBuffer = new Date( +tStartBuffer + bufferDuration );
          tEndBufferRight = new Date( +tStartBufferRight + bufferDuration );


        }
        //
        // right: new left buffer = old centre buffer -> loaded = (old
        //       centre loaded)
        //       new centre buffer = old right buffer -> loaded = (old
        //       right loaded )
        //       new right buffer = old left buffer -> loaded = false
        if( leftOrRight === 'right' ){


          tmp1 = bufferLeft;
          tmp2 = bufferRight;
          bufferLeft = buffer;
          buffer = tmp2;
          bufferRight = tmp1;

          tmp1 = ctxL;
          tmp2 = ctxR;
          ctxL = ctx0;
          ctx0 = tmp2;
          ctxR = tmp1;

          tmp1 = bufferLeftLoaded;
          tmp2 = bufferRightLoaded;
          bufferLeftLoaded = bufferLoaded;
          bufferLoaded = tmp2;
          bufferRightLoaded = false;

          tmp1 = tStartBufferLeft;
          tmp2 = tStartBufferRight;
          tStartBufferLeft = tStartBuffer;
          tStartBuffer = tmp2;
          tStartBufferRight = new Date( +tmp2 + bufferDuration - duration );

          tEndBufferLeft = new Date( +tStartBufferLeft + bufferDuration );
          tEndBuffer = new Date( +tStartBuffer + bufferDuration );
          tEndBufferRight = new Date( +tStartBufferRight + bufferDuration );

        }
      }

      function prepare( start1, stop ){
        // We are going to move the view to [start1, stop] shortly
        // Check if we need to load new data
        //
        // 1) If our buffer and view start times are undefined, or
        //   if the new start time is earlier than the left buffer, or
        //   if the new end time is later than the right buffer:
        //    init the buffers
        if( !tStartBuffer || !tEndBuffer || !tStartBufferLeft || !tEndBufferLeft ||
          !tStartBufferRight || !tEndBufferRight || ( stop < tStartBufferLeft ) ||
          (start1 > tEndBufferRight) ){
          initBuffers( start1, stop );
        }
        //
        // 2) Which buffer do we want to show?
        //  o if t0Left <= start1 and stop < tEndLeft
        //    use left buffer and rotate buffers left
        //  o if t0 <= start1 < tEnd
        //    use middle buffer
        //  o it toRight <= start1 and stop < tEndRight
        //    use right buffer and rotate buffers right
        if( tStartBufferLeft <= start1 && stop <= tEndBufferLeft ){
          rotateBuffers('left');
        }
        else if( tStartBufferRight <= start1 && stop <= tEndBufferRight ){
          rotateBuffers('right');
        }
        //
        // 3) if centre buffer has not been loaded:
        //    load it now
        if( !bufferLoaded ){
          drawToBuffer( 0 );
        }
        //
        // 4) if start1 <= tTriggerLeft and left buffer not loaded
        //  load the left buffer
        var tTriggerLeft = +tStartBuffer + duration/2;
        if( start1 < tTriggerLeft && !bufferLeftLoaded ){
          drawToBuffer( -1 );
        }
        //
        // 5) if end >= tTriggerRight and right buffer not loaded
        //  load the right buffer
        var tTriggerRight = +tEndBuffer - duration/2;
        if( tTriggerRight <= stop && !bufferRightLoaded ){
          drawToBuffer( +1 );
        }

      }

      // update the chart when the context changes
      context.on('change.chart-' + id, change);
      context.on('focus.chart-' + id, focus);
      context.on('update.chart-' + id, update);
      context.on('prepare.chart-' + id, prepare);

      // Display the first metric chagne immediately,
      // but defer subsequent updates to the canvas change
      // Note that someone still needs to listen to the metric,
      // so that it continues to update automatically
      //var metricChange = function( theMetric ){
        //return function( start, stop ){
          //change(start, stop), focus();
        //};
      //};

      //if( metric_ instanceof Array ){
        //for( var j = 0; j < metric_.length; ++j ){
          //metric_[j].on('change.chart-' + id, metricChange(metric_[j]) );
        //}
      //}
      //else{
        //metric_.on('change.chart-' + id, metricChange(metric_) );
      //}
    });
  }

  chart.remove = function(selection) {

    selection
      .on('mousemove.chart', null)
      .on('mouseout.chart', null);

    selection.selectAll('canvas')
      .each(remove)
      .remove();

    selection.selectAll('.title,.value')
      .remove();

    function remove(d) {
      //d.metric.on('change.chart-' + d.id, null);
      context.on('change.chart-' + d.id, null);
      context.on('focus.chart-' + d.id, null);
      context.on('update.chart-' + d.id, null);
      context.on('prepare.chart-' + d.id, null);
    }
  };

  chart.height = function(_) {
    if(!arguments.length) return height;
    height = buffer.height = _;
    return chart;
  };

  chart.scale = function(_) {
    if(!arguments.length) return scale;
    scale = _;
    return chart;
  };

  chart.extent = function(_) {
    if(!arguments.length) return extent;
    extent = _;
    return chart;
  };

  chart.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return chart;
  };

  chart.format = function(_) {
    if (!arguments.length) return format;
    format = _;
    return chart;
  };

  chart.colors = function(_) {
    if (!arguments.length) return colors;
    colors = _;
    return chart;
  };

  chart.lineWidth = function(_) {
    if (!arguments.length) return lineWidth;
    lineWidth = _;
    return chart;
  };

  return chart;
};

