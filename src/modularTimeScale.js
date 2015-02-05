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

