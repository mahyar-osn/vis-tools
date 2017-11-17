//==============================================================================
// CesiumCzml object
//
// Events:
//  "message": emitted to send messages to the app's message area
//
// Depends on:
//  async
//  lodash
//  Cesium
//  VisSet
//==============================================================================
function CesiumCzml(appEmitter, viewer, visSet)
{
  // UI-related
  this._selector = "body";
  this._appEmitter = appEmitter;

  // Other data members
  this._viewer = viewer;
  this._set = visSet;
  this._dataSources = {};   // Dict<sourceName, CZMLDataSource>

  // Mix-in Emitter to ourselves so we can emit/sink events
  Emitter(this);
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------
CesiumCzml.prototype.initialize = function(selector)
{
  this._selector = selector;

  // This load step should be in VisSet.load. Maybe there needs to be a Cesium
  // adapter that you add to VisSet to add the ability to create CzmlDataSources
  // or something like that. Also these should be done in parallel * IMPROVE
  var instance = this;
  var czmlLinks = this._set.links.czml;
  var loadFuncs = [];
  _.forEach(czmlLinks, function(link, key)
  {
    loadFuncs.push(function(callback)
    {
      Cesium.CzmlDataSource.load(link.url)
        .then(function(dataSource)
        {
          instance._dataSources[key] = dataSource;
          instance._viewer.dataSources.add(dataSource);
          instance._viewer.clock.shouldAnimate = false;
          callback(null);
        })
        .otherwise(function()
        {
          callback(link.url);
        });
    });
    // Additionally, if there's a legend symbol for this layer, preload that
    // and stash its size. We'll need that later in _addUi().
    if ("legendSymbol" in link)
      loadFuncs.push(function(callback)
      {
        var img = new Image();
        img.onload = function()
        {
          link.legendSymbolWidth = this.width;
          link.legendSymbolHeight= this.height;
          callback(null);
        };
        img.src = "image/" + link.legendSymbol + ".png";
      });
  });

  // Do all the CZML loads in parallel
  async.parallel(loadFuncs, function allCompleteOrError(err)
  {
    if (err)
    {
      instance.emit("message", "ERROR: Could not load CZML layer " + err + ".",
        "error");
    }
    else
    {
      // Add czml-layer-related UI elements
      instance._viewer.clock.shouldAnimate = false;
      instance._addUi();
    }
  });
};

//------------------------------------------------------------------------------
CesiumCzml.prototype.update = function(timestep)
{
  // Nothing to do. The CZML layers know how to handle themselves.
};

//------------------------------------------------------------------------------
CesiumCzml.prototype.getState = function()
{
  var result = {};
  _.forEach(this._dataSources, function(source, sourceKey)
  {
    result[sourceKey] = source.show;
  });
  return result;
};

//------------------------------------------------------------------------------
CesiumCzml.prototype.setState = function(state)
{
  // These setChecked calls will cause callbacks which update the layers.
  var instance = this;
  _.forEach(state, function(show, dataLayer)
  {
    var $rollup =
      $(instance._selector).find("div[data-layer='" + dataLayer + "']");
    if ($rollup.length > 0)
      $rollup.rollup("setChecked", show);
  });
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
CesiumCzml.prototype._onRollupChanged = function(evt, data)
{
  if (data.type === "checkbox")
  {
    var $rollup = $(evt.target).closest(".rollup");
    var sourceName = $rollup.attr("data-layer");
    this._dataSources[sourceName].show = data.newValue;
    this._set.links.czml[sourceName].show = data.newValue;
  }
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
CesiumCzml.prototype._addUi = function()
{
  var rollupCount = $(this._selector).find(".rollup").length;
  var instance = this;

  // Make an empty rollup for each CZML source present in the set
  var czmlLinks = this._set.links.czml;
  var keys = Object.keys(czmlLinks).sort();
  for (var i = 0; i < keys.length; i++)
  {
    var key = keys[i];
    var link = czmlLinks[key];
    if ("legendSymbol" in link && "legendColor" in link &&
      "legendSymbolWidth" in link && "legendSymbolHeight" in link)
    {
      // Title with legend symbol
      var svgText = Utils.colorizeImageSync(
        "image/" + link.legendSymbol + ".png",
        link.legendColor, link.legendSymbolWidth, link.legendSymbolHeight);
      var title = link.friendlyName + "&nbsp;&nbsp;" + svgText;
      var $rollup = $("<div data-layer='" + keys[i] + "'></div>")
        .appendTo(instance._selector);
      $rollup.rollup({
        title: title,
        tooltip: "Toggle " + link.friendlyName.toLowerCase() +
          " (" + (rollupCount + i + 1) + ")",
        checkbox: true,
        initiallyChecked: link.show,
        initiallyOpen: false,
        titleOnly: true,
        changed: function(evt, data) { instance._onRollupChanged(evt, data); }
      });
      instance._dataSources[key].show = link.show;
    }
    else
    {
      // No legend symbol
      var $rollup = $("<div data-layer='" + keys[i] + "'></div>")
        .appendTo(this._selector);
      $rollup.rollup({
        title: link.friendlyName,
        tooltip: "Toggle " + link.friendlyName.toLowerCase() +
          " (" + (rollupCount + i + 1) + ")",
        checkbox: true,
        initiallyChecked: link.show,
        initiallyOpen: false,
        titleOnly: true,
        changed: function(evt, data) { instance._onRollupChanged(evt, data); }
      });
      this._dataSources[key].show = link.show;
    }
  }
};

//------------------------------------------------------------------------------
CesiumCzml._makeFriendlyName = function(str)
{
  return str.replace(/([a-z])([A-Z][a-z])/g, "$1 $2").replace("_", " ");
};
