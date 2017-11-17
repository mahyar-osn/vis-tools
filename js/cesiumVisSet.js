//==============================================================================
// cesiumVisSet - Adds Cesium-specific methods to VisSet object.
//
// Depends on:
//  visSet.js
//==============================================================================

//------------------------------------------------------------------------------
VisSet.prototype.getCesiumBoundingRectangle = function()
{
  var bbox = this.getBoundingBox();
  if (!bbox) return Cesium.Rectangle.fromDegrees(0, 0, 0, 0);
  return Cesium.Rectangle.fromDegrees(  // wsen
    bbox.longitudeMin,
    bbox.latitudeMin,
    bbox.longitudeMax,
    bbox.latitudeMax);
};

//------------------------------------------------------------------------------
VisSet.prototype.clockToTimestep = function(viewer, time)
{
  var currentTime = (time === undefined) ? viewer.clock.currentTime : time;
  var timestep = this.julianDateToTimestep(viewer, currentTime);
  return timestep;
};

//------------------------------------------------------------------------------
VisSet.prototype.julianDateToTimestep = function(viewer, julDate)
{
  var curXValue = Cesium.JulianDate.toDate(julDate).getTime();
  var startMs = Cesium.JulianDate.toDate(viewer.clock.startTime).getTime();
  var delta = curXValue - startMs;
  var timestep = Math.floor(delta / 86400000);  // milliseconds in one day
  if (timestep < 0)
     timestep = 0;
  if (timestep >= this.timestepCount)
     timestep = this.timestepCount - 1;
  return timestep;
};

//------------------------------------------------------------------------------
VisSet.serializeCamera = function(viewer)
{
  var camera = viewer.scene.camera;
  return {
    position: {
      x: camera.positionWC.x,
      y: camera.positionWC.y,
      z: camera.positionWC.z
    },
    orientation: {
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll
    }
  };
};

//------------------------------------------------------------------------------
VisSet.deserializeCamera = function(viewer, state)
{
  viewer.scene.camera.flyTo({
    destination: new Cesium.Cartesian3(
      state.position.x, state.position.y, state.position.z),
    orientation: state.orientation
  });
};
