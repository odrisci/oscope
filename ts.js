/*! ts v0.0.0 - 2014-07-08 
 * License: MIT */
(function(exports){
  var ts = exports.ts = { version : '0.0.0' };

  function ts_sortTimeSeriesArray( arr ){
    return arr.sort( function( a, b ){
      return a[0] - b[0];
    });
  }

  // Creates a new timeseries object
  ts.timeSeries = function(){
    var data = [],
        timeSeries = new ts_timeSeries();

    // Inserts the elements from ots into this timeSeries
    timeSeries.splice = function( ots ){

      var odata, i;
      // Check that ots is of the right form:
      // 1) ots is a timeSeries object
      // 2) ots is an array of [ts, value] pairs
      if( ots instanceof ts_timeSeries ){
        odata = ots.data();
      }
      else if( ots instanceof Array ){
        odata = ots;
        //// now ensure that the elements are good:
        //for( i = 0; i < odata.length; ++i ){
          //if( odata[i] instanceof Array ){
            //odata[i][0] = +odata[i][0];
          //}
          //else{
            //alert( 'input must be a valid time series' );
            //return timeSeries;
          //}
        //}

        ts_sortTimeSeriesArray( odata );
      }
      else{
        alert( 'input must be a timeSeries or an array of [timestamp, value] pairs' );
        return timeSeries;
      }

      if( odata.length === 0 ){
        return timeSeries;
      }

/*
      // Simpler idea:
      var args = [ data.length, 0 ].concat( odata );
      Array.prototype.splice.apply( data, args );

      ts_sortTimeSeriesArray( data );
*/
      // Utility function
      var firstIndexGreaterThan = function( timeSeries, timeStamp, start ){
        if( timeSeries.length === 0 ){
          return 0;
        }

        var stop = timeSeries.length-1, t0, t1, tGuess;

        if( start === undefined ) start = 0;

        t0 = timeSeries[start][0];
        t1 = timeSeries[stop][0];


        if( timeStamp < t0 ){
          return start;
        }

        if( timeStamp >= t1 ){
          return timeSeries.length;
        }

        var guess;

        while( start < stop - 1 ){

          guess = Math.floor( (start+stop)/2 );

          tGuess = timeSeries[guess][0];

          if( tGuess > timeStamp ){
            stop = guess;
          }
          else{
            start = guess;
          }

          t0 = timeSeries[start][0];
          t1 = timeSeries[stop][0];

        }

        return stop;

      };

      var j = 0,
          k = 0,
          args;

      i = 0;

      while( j < odata.length ){

        // Now find i: the first index in data which is greater than the first element in odata
        i = firstIndexGreaterThan( data, odata[j][0], i );

        // Replace existing data:
        while( i > 1 && i <= data.length && j < odata.length && data[i-1][0] === odata[j][0] ){
          data[i-1] = odata[j];
          ++i; ++j;
        }

        if( i == data.length ){
          args = [i, 0].concat( odata.slice(j) );
          Array.prototype.splice.apply( data, args );
          break;
        }

        if( i > data.length || j > odata.length ){
          break;
        }

        k = firstIndexGreaterThan( odata, data[i][0], j );
        args = [i,0].concat( odata.slice(j,k) );
        Array.prototype.splice.apply( data, args );

        j = k;

      }

      return timeSeries;

    };

    // Inserts a single [timstamp, value] pair into the timeSeries
    timeSeries.insert = function( timeStamp, value ){
      // Data is sorted by timeStamp, so we simply search backwards to find the place
      // to insert the data. Backwards search is used since we typically at to the end of a
      // timeseries
      var i = data.length - 1;

      if( i < 0 ){
        data.push( [timeStamp, value] );
        return this;
      }

      while( i > 0  && data[i][0] > timeStamp ){
        i--;
      }

      if( data[i][0] === timeStamp ){
        data[i][1] = value; // overwrite old data
      }
      else{
        data.splice( i+1, 0, [timeStamp, value] );
      }

      return timeSeries;
    };

    // Getter for the internal data - an array of [timeStamp, value] pairs
    timeSeries.data = function(){
      return data;
    };

    // Returns the [ts, value] pair nearest to timeStamp.
    // If an interpolator is provided then the value will be interpolated
    // otherwise a simple rounding is used.
    timeSeries.getValueNearest = function( timeStamp, interpolator ){
      if( data.length === 0 )
        return [];

      var start = 0,
          stop = data.length-1,
          guess,
          t0 = data[start][0],
          t1 = data[stop][0],
          i = 0;

      if( t0 >= timeStamp ){
        return data[start];
      }

      if( t1 <= timeStamp ){
        return data[stop];
      }

      while( start < stop - 1 ){

        guess = Math.floor( (start+stop)/2 );

        if( data[guess][0] > timeStamp ){
          stop = guess;
        }
        else{
          start = guess;
        }

        t0 = data[start][0];
        t1 = data[stop][0];

        if( ++i > data.length/2 ){
          console.log( 'Aaarggh!' );
          break;
        }

      }

      if( Math.abs(timeStamp - t0) > Math.abs(timeStamp - t1) ){
        guess = stop;
      }
      else{
        guess = start;
      }

      return data[guess];
      /*

      var sdata = data.map( function(a){ return Math.abs( a[0] - timeStamp ); } );

      var minVal = sdata[0], minIdx = 0;
      for( var i = 1; i < sdata.length; ++i ){
        if( sdata[i] < minVal ){
          minIdx = i;
          minVal = sdata[i];
        }
      }

      return data[minIdx];
      */
    };

    // Returns an array of [ts, value] pairs such that for all ts:
    // start <= ts < stop
    timeSeries.getValuesInRange = function( start, stop ){

      if( data.length === 0 ){
        return [];
      }

      var i = data.length-1,
          currT = data[i][0],
          ret = [];

      while( i >= 0 && (currT = data[i][0]) >= start ){
        if( currT < stop ){
          ret.unshift( data[i] );
        }
        --i;
      }

      return ret;

    };

    // Drop old data
    timeSeries.dropDataBefore = function( lastTimeToKeep ){

      var i = 0;
      while( i < data.length && data[i][0] < lastTimeToKeep ){
        i++;
      }

      data.splice(0,i);

      return timeSeries;

    };

    return timeSeries;

  };

  function ts_timeSeries() {}
})(this);
