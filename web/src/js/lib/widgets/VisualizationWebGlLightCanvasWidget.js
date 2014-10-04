/**
 * This widget renders the visualization defined by a VisualizationModel onto
 * a canvas element that will fill the parent element.
 */
cinema.views.VisualizationWebGlLightCanvasWidget = Backbone.View.extend({
    // Expose primitive events from the canvas for building interactors
    events: {
        'click .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:click', e);
        },
        'dblclick .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:dblclick', e);
        },
        'mousedown .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:mousedown', e);
        },
        'mousemove .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:mousemove', e);
        },
        'mouseup .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:mouseup', e);
        },
        'mousewheel .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:mousewheel', e);
        },
        'DOMMouseScroll .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:mousewheel', e);
        },
        'keypress .c-webglvis-webgl-canvas': function (e) {
            this.trigger('c:keypress', e);
        },
        'contextmenu .c-webglvis-webgl-canvas': function (e) {
            e.preventDefault();
        }
    },

    //subclass uses to extend
    _privateInit: function () {
    },

    /**
     * This widget should be initialized with a visModel as the model parameter
     * and optionally a pre-existing CompositeImageManager.
     *
     * @param model The VisualizationModel being rendered.
     * @param [layers] A LayerModel to use. If none is passed, creates one
     *        internally.
     * @param [compositeManager] A CompositeImageManager to use. If none is
     *        passed, uses the one that is set as the imageManager property of
     *        the visModel. If that is not set, creates one internally.
     */
    initialize: function (settings) {
        this.controls= settings.controls;
        this.viewpoint = settings.viewpoint;

        if (!this.model.loaded()) {
            this.listenToOnce(this.model, 'change', function () {
                this.initialize(settings);
            });
            return;
        }

        this._privateInit();
        this.compositeModel = new cinema.decorators.Composite(this.model);
        this.layers = settings.layers || new cinema.models.LayerModel(this.compositeModel.getDefaultPipelineSetup());
        this.backgroundColor = settings.backgroundColor || '#ffffff';
        this.orderMapping = {};
        this.compositeCache = {};
        this._fields = {};

        this.compositeManager = settings.compositeManager ||
            new cinema.utilities.CompositeImageManager({
                visModel: this.model
            });

        this._computeLayerOffset();
        this._first = true;

        this.avgElapsedMillis = 0.0;
        this.totalElapsedMillis = 0.0;
        this.compositeCount = 0;

        this.listenTo(this.compositeManager, 'c:error', function (e) {
            this.trigger('c:error', e);
        });
        this.listenTo(this.compositeManager, 'c:data.ready', function (data, fields) {
            if (_.isEqual(fields, this._fields)) {
                var startMillis = Date.now();

                this._writeCompositeBuffer(data);
                if (this._first) {
                    this._first = false;
                    this.resetCamera();
                }
                this.drawImage();

                var elapsedMillis = Date.now() - startMillis;
                this.compositeCount += 1;
                this.totalElapsedMillis += elapsedMillis;
                this.averageElapsedMillis = this.totalElapsedMillis / this.compositeCount;

                var curFps = Math.floor((1.0 / elapsedMillis) * 1000);
                var avgFps = Math.floor((1.0 / this.averageElapsedMillis) * 1000);
                this.$('.s-timing-info-current').text(curFps);
                this.$('.s-timing-info-average').text(avgFps);
            }
        });
        this.listenTo(this.controls, 'change', this.drawImage);
        this.listenTo(this.viewpoint, 'change', this.drawImage);
        this.listenTo(this.layers, 'change', this.updateQuery);

        this.xscale = 1.0;
        this.yscale = 1.0;

        this.webglCompositor = settings.webglCompositor;

        // Generate map of where to find needed sprite offets for each layer
        this._fieldNameMap = {};
        this._lightingFields = [ 'nX', 'nY', 'nZ', 'vRTData' ];
        this._contextMap = { 'nX': null,
                             'nY': null,
                             'nZ': null,
                             'vRTData': null };

        var fieldJson = this.model.attributes.metadata.fields;
        for (var fieldCode in fieldJson) {
            if (_.has(fieldJson, fieldCode)) {
                this._fieldNameMap[fieldJson[fieldCode]] = fieldCode;
            }
        }
    },

    render: function () {
        this.$el.html(cinema.templates.webglLightVisCanvas());


        if (this.$('.c-webgllit-webgl-canvas').length > 0) {
            var imgDim = this.compositeModel.getImageSize();
            var imgAspect = imgDim[0] / imgDim[1];
            var vpDim = [
                this.$('.c-webgllit-webgl-canvas').parent().width(),
                this.$('.c-webgllit-webgl-canvas').parent().height()
            ];
            var vpAspect = vpDim[0] / vpDim[1];

            $(this.$('.c-webgllit-webgl-canvas')[0]).attr({
                width: vpDim[0],
                height: vpDim[1]
            });

            if (vpAspect > imgAspect) {
                this.xscale = vpAspect;
                this.yscale = 1.0;
            } else {
                this.xscale = 1.0;
                this.yscale = 1.0 / vpAspect;
            }

            this.webglCompositor.init(imgDim,
                                      this.$('.c-webgllit-webgl-canvas')[0]);
        }

        return this;
    },

    _computeLayerOffset: function () {
        var query;

        this.layerOffset = {};

        query = this.layers.serialize();
        for (var i = 0; i < query.length; i += 2) {
            var layer = query[i];

            if (query[i + 1] === '_') {
                this.layerOffset[layer] = -1;
            } else {
                this.layerOffset[layer] = this.compositeModel.getSpriteSize() -
                    this.compositeModel.getOffset()[query.substr(i, 2)];
            }
        }
    },

    _spherical2CartesianN: function (phi, theta) {
        var phiRad = (180.0 - phi) * Math.PI / 180.0;
        var thetaRad = (180.0 - theta) * Math.PI / 180.0;
        var x = Math.sin(thetaRad) * Math.cos(phiRad);
        var y = Math.sin(thetaRad) * Math.sin(phiRad);
        var z = Math.cos(thetaRad);
        return [x, y, z];
    },

    _spherical2Cartesian: function (phi, theta) {
        return this._spherical2CartesianN(parseFloat(phi), parseFloat(theta));
    },

    /**
     * Computes the composite image and writes it into the composite buffer.
     * @param data The payload from the composite image manager c:data.ready
     * callback. This will write computed composite data back into that
     * cache entry so it won't have to recompute it.
     */
    _writeCompositeBuffer: function (data) {

        var compositeCanvas = this.$('.c-webgllit-composite-buffer')[0],
            webglCanvas = this.$('.c-webgllit-webgl-canvas')[0],
            nxCanvas = this.$('.c-webgllit-nx-buffer')[0],
            nyCanvas = this.$('.c-webgllit-ny-buffer')[0],
            nzCanvas = this.$('.c-webgllit-nz-buffer')[0],
            scalarCanvas = this.$('.c-webgllit-scalar-buffer')[0],
            dim = this.compositeModel.getImageSize(),
            spritesheetDim = [ data.image.width, data.image.height ],
            compositeCtx = compositeCanvas.getContext('2d'),
            nxCtx = nxCanvas.getContext('2d'),
            nyCtx = nyCanvas.getContext('2d'),
            nzCtx = nzCanvas.getContext('2d'),
            scalarCtx = scalarCanvas.getContext('2d'),
            composite = this.compositeCache[data.key];

        $(compositeCanvas).attr( { width: dim[0],            height: dim[1] });
        $(nxCanvas).attr(        { width: dim[0],            height: dim[1] });
        $(nyCanvas).attr(        { width: dim[0],            height: dim[1] });
        $(nzCanvas).attr(        { width: dim[0],            height: dim[1] });
        $(scalarCanvas).attr(    { width: dim[0],            height: dim[1] });

        this.webglCompositor.clearFbo();

        var idxList = [];
        for (var layerName in this.layerOffset) {
            if (_.has(this.layerOffset, layerName)) {
                // Figure out if this is a "lightable" layer
                var colorByList = this.model.attributes.metadata.layer_fields[layerName];
                var lightableLayer = true;
                var lightingOffsets = {};
                for (var j = 0; j < this._lightingFields.length; j+=1) {
                    if (!_.contains(colorByList, this._fieldNameMap[this._lightingFields[j]])) {
                        lightableLayer = false;
                        break;
                    } else {
                        var offsetCode = layerName + this._fieldNameMap[this._lightingFields[j]];
                        lightingOffsets[this._lightingFields[j]] = this.model.attributes.metadata.offset[offsetCode];
                    }
                }

                if (lightableLayer === true) {
                    // idxList.push({ 'scalarOffset': });
                    idxList.push(lightingOffsets);
                } else {
                    idxList.push(this.layerOffset[layerName]);
                }
            }
        }

        var imgw = dim[0], imgh = dim[1];
        var viewDir = this._spherical2Cartesian(this.controls.getControl('phi'), this.controls.getControl('theta'));

        for (var i = 0; i < idxList.length; i+=1) {
            if (typeof(idxList[i]) === 'number') {
                //console.log(i);
                var layerIdx = idxList[i];
                var srcX = 0;
                var srcY = layerIdx * imgh;

                // Because the png has transparency, we need to clear the canvas, or else
                // we end up with some blending when we draw the next image
                compositeCtx.clearRect(0, 0, imgw, imgh);
                compositeCtx.drawImage(data.image, srcX, srcY, imgw, imgh, 0, 0, imgw, imgh);

                this.webglCompositor.drawCompositePass(compositeCanvas);
            } else {
                var lOffMap = idxList[i];
                var srcX = 0, srcY = 0;

                // Copy the nx buffer
                srcY = lOffMap['nX'] * imgh;
                nxCtx.clearRect(0, 0, imgw, imgh);
                nxCtx.drawImage(data.image, srcX, srcY, imgw, imgh, 0, 0, imgw, imgh);

                // Copy the ny buffer
                srcY = lOffMap['nY'] * imgh;
                nyCtx.clearRect(0, 0, imgw, imgh);
                nyCtx.drawImage(data.image, srcX, srcY, imgw, imgh, 0, 0, imgw, imgh);

                // Copy the nz buffer
                srcY = lOffMap['nZ'] * imgh;
                nzCtx.clearRect(0, 0, imgw, imgh);
                nzCtx.drawImage(data.image, srcX, srcY, imgw, imgh, 0, 0, imgw, imgh);

                // Copy the scalar buffer
                srcY = lOffMap['vRTData'] * imgh;
                scalarCtx.clearRect(0, 0, imgw, imgh);
                scalarCtx.drawImage(data.image, srcX, srcY, imgw, imgh, 0, 0, imgw, imgh);

                this.webglCompositor.drawLitCompositePass(viewDir, nxCanvas, nyCanvas, nzCanvas, scalarCanvas);
            }
        }

        this.trigger('c:composited');
    },

    /**
     * Call this after data has been successfully rendered onto the composite
     * canvas, and it will draw it with the correct scale, zoom, and center
     * onto the render canvas.
     */
    drawImage: function () {
        var zoomLevel = this.viewpoint.get('zoom'),
            drawingCenter = this.viewpoint.get('center');

        // console.log("zoom: " + zoomLevel + ", center: " + drawingCenter);

        this.webglCompositor.drawDisplayPass(this.xscale * zoomLevel, this.yscale * zoomLevel);

        this.trigger('c:drawn');
    },

    /**
     * Reset the zoom level and drawing center such that the image is
     * centered and zoomed to fit within the parent container.
     */
    resetCamera: function () {
        var w = this.$el.width(),
            h = this.$el.height(),
            iw = this.$('.c-webgllit-composite-buffer').width(),
            ih = this.$('.c-webgllit-composite-buffer').height();

        this.viewpoint.set({
            zoom: Math.min(w / iw, h / ih),
            center: [w / 2, h / 2]
        });
        return this;
    },

    /**
     * Change the viewpoint to show a different image.
     * @param viewpoint An object containing "time", "phi", and "theta" keys. If you
     * do not pass this, simply renders the current this.viewpoint value.
     * @return this, for chainability
     */
    showViewpoint: function (forced) {
        var changed = false,
            fields = this.controls.getControls();

        // Search for change
        for (var key in fields) {
            if (_.has(this._fields, key)) {
                if (this._fields[key] !== fields[key]) {
                    changed = true;
                }
            } else {
                changed = true;
            }
        }
        this._fields = _.extend(this._fields, fields);
        if (changed || forced) {
            this.compositeManager.downloadData(this._fields);
        } else {
            this.drawImage();
        }
        return this;
    },

    updateQuery: function (query) {
        this.orderMapping = {};
        this.compositeCache = {};
        this._computeLayerOffset();
        this._fields = {}; // force redraw
        this.showViewpoint();
    },

    /**
     * Maps an [x, y] value relative to the canvas element to an [x, y] value
     * relative to the image being rendered on the canvas.
     * @param coords 2-length list representing [x, y] offset into the canvas
     * element.
     * @returns the corresponding [x, y] value of the image being rendered on
     * the canvas, respecting zoom level and drawing center, or null if the
     * input coordinates are on a part of the canvas outside of the image render
     * bounds. If not null, this will be a value bounded in each dimension by
     * the length of the composited image in that dimension.
     */
    mapToImageCoordinates: function (coords) {
        // TODO
    }
});
