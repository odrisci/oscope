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
