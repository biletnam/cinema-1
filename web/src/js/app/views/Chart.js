(function () {
    var sharedDataMap = {},
        visibilityMap = { 'histogram': false, 'information': false };

    var getSharedData = function (model, container, analysis) {
        var key = model.getHash() + '::' + ($(container).attr('container-uid') || 'main');
        if (_.has(sharedDataMap, key)) {
            return sharedDataMap[key];
        } else {
            var control = new cinema.models.ControlModel({
                    info: model
                }),
                viewpoint = new cinema.models.ViewPointModel({
                    controlModel: control
                }),
                renderView = new cinema.views.ChartVisualizationCanvasWidget({
                    el: $('.c-body-container', container),
                    model: model,
                    controlModel: control,
                    viewpoint: viewpoint
                }),
                toolsWidget = new cinema.views.ChartToolsWidget({
                    el: $('.c-tools-panel', container),
                    model: model,
                    controlModel: control,
                    viewport: renderView,
                    toolbarSelector: '.c-panel-toolbar'
                }),
                histogram = null,
                informationWidget = null,
                histogramWidget = null,
                searchView = null,
                metaDataSearchView = null,
                metaDataInformationWidget = null;

            if (analysis) {
                histogram = new cinema.models.StaticHistogramModel({
                    basePath: model.get('basePath'),
                    analysisInfo: model.get('metadata').analysis,
                    namePattern: model.get('name_pattern')
                });
                informationWidget = new cinema.views.ComposableInformationWidget({
                    el: $('.c-information-panel', container),
                    model: model,
                    controlModel: control,
                    exclude: ['layer', 'filename'],
                    analysisInfo: model.get('metadata').analysis,
                    toolbarSelector: '.c-panel-toolbar'
                });
                histogramWidget = new cinema.views.StaticHistogramWidget({
                    el: $('.c-static-histogram-panel', container),
                    basePath: model.get('basePath'),
                    histogramModel: histogram,
                    viewpoint: viewpoint,
                    controlModel: control,
                    visModel: model,
                    analysisInfo: model.get('metadata').analysis,
                    toolbarSelector: '.c-panel-toolbar'
                });
                searchView = new cinema.views.StaticSearchPage({
                    el: $('.c-body-container', container),
                    basePath: model.get('basePath'),
                    histogramModel: histogram,
                    visModel: model,
                    controlModel: control
                });
            } else {
                /*jshint -W035 */
                /*
                metaDataSearchView = new cinema.views.MetaDataStaticSearchPage({
                    el: $('.c-body-container', container),
                    visModel: model,
                    controlModel: control
                });
                metaDataInformationWidget = new cinema.views.MetaDataSearchInformationWidget({
                    el: $('.c-information-panel', container),
                    model: model,
                    controlModel: control,
                    exclude: ['layer', 'filename'],
                    toolbarSelector: '.c-panel-toolbar'
                });
                */
            }

            var shared = {
                key: key,
                control: control,
                histogram: histogram,
                viewpoint: viewpoint,
                informationWidget: informationWidget,
                renderView: renderView,
                histogramWidget: histogramWidget,
                toolsWidget: toolsWidget,
                searchView: searchView,
                metaDataSearchView: metaDataSearchView,
                metaDataInformationWidget: metaDataInformationWidget,
                remove: function () {

                }
            };
            sharedDataMap[key] = shared;
            return shared;
        }
    };

    var freeSharedDataMap = function (key) {
        delete sharedDataMap[key];
    };

    var visibility = function (name, value) {
        if (value === undefined) {
            return visibilityMap[name];
        } else {
            visibilityMap[name] = value;
        }
    };

    cinema.events.on('toggle-control-panel', function(event) {
        visibility(event.key, event.visible);
    });

    cinema.views.ChartView = Backbone.View.extend({
        initialize: function (opts) {
            this._hasAnalysis = _.has(this.model.get('metadata'), 'analysis');
            var sharedData = getSharedData(this.model, this.$el, this._hasAnalysis);
            this.key = sharedData.key;

            this.controlModel = sharedData.control;
            this.viewpointModel = sharedData.viewpoint;
            this.renderView = sharedData.renderView;
            this.toolsWidget = sharedData.toolsWidget;

            if (this._hasAnalysis) {
                this.staticHistogram = sharedData.histogramWidget;
                this.searchInformation = sharedData.informationWidget;
                this.controlList = opts.defaultControls.slice(0);
                this.controlList.push(
                    { position: 'center', key: 'static-histogram', icon: 'icon-chart-bar', title: 'Histogram' }
                );
                sharedData.histogram.fetch( { 'controlModel': this.controlModel } );
            } else {
                this.searchInformation = sharedData.metaDataInformationWidget;
            }

            this.listenTo(this.controlModel, 'change', this.refreshCamera);
            this.listenTo(this.viewpointModel, 'change', this.refreshCamera);
            this.listenTo(cinema.events, 'c:resetCamera', this.resetCamera);
        },

        render: function () {
            this.renderView.setElement(this.$('.c-body-container')).render().showViewpoint(true);
            this.toolsWidget.setElement(this.$('.c-tools-panel')).render();
            //this.searchInformation.setElement(this.$('.c-information-panel')).render();
            //this.$('.c-information-panel').toggle(visibility('information'));
            if (this._hasAnalysis) {
                this.staticHistogram.setElement(this.$('.c-static-histogram-panel')).render();
                this.$('.c-static-histogram-panel').toggle(visibility('histogram'));
            }
            return this;
        },

        refreshCamera: function () {
            if (this.renderView) {
                this.renderView.showViewpoint();
            }
        },

        resetCamera: function () {
            if (this.renderView) {
                this.renderView.resetCamera();
            }
        },

        remove: function () {
            getSharedData(this.compositeModel, this.$el, this._hasAnalysis).remove();

            // SharedData
            freeSharedDataMap(this.key);

            // Connections to SharedData
            this.key = null;

            // Models
            this.controlModel.remove();
            this.viewpointModel.remove();

            // Views
            this.renderView.remove();
            this.toolsWidget.remove();
            if (this._hasAnalysis) {
                this.staticHistogram.remove();
                //this.searchInformation.remove();
            } else {
                /*jshint -W035 */
                //this.searchInformation.remove();
            }
        }
    });

    cinema.views.ChartSearchView = Backbone.View.extend({
        initialize: function (opts) {
            this._hasAnalysis = _.has(this.model.get('metadata'), 'analysis');
            var sharedData = getSharedData(this.model, this.$el, this._hasAnalysis);
            this.key = sharedData.key;

            this.controlModel = sharedData.control;
            this.viewpointModel = sharedData.viewpoint;

            if (this._hasAnalysis) {
                this.searchView = sharedData.searchView;
                this.staticHistogram = sharedData.histogramWidget;
                this.searchInformation = sharedData.informationWidget;
                this.controlList = opts.defaultControls.slice(0);
                this.controlList.push(
                    { position: 'center', key: 'static-histogram', icon: 'icon-chart-bar', title: 'Histogram' }
                );
            } else {
                this.searchView = sharedData.metaDataSearchView;
                this.searchInformation = sharedData.metaDataInformationWidget;
            }
        },

        render: function () {
            //this.searchView.setElement(this.$('.c-body-container')).render();
            //this.searchInformation.setElement(this.$('.c-information-panel')).render();
            //this.$('.c-information-panel').toggle(visibility('information'));
            if (this._hasAnalysis) {
                this.staticHistogram.setElement(this.$('.c-static-histogram-panel')).render();
                this.$('.c-static-histogram-panel').toggle(visibility('histogram'));
            }
            return this;
        },

        remove: function () {
            getSharedData(this.model, this.$el, this._hasAnalysis).remove();

            // SharedData
            freeSharedDataMap(this.key);

            // Connections to SharedData
            this.key = null;

            // Models
            this.controlModel.remove();
            this.viewpointModel.remove();

            // Views
            //this.searchView.remove();
            //this.searchTools.remove();
            if (this._hasAnalysis) {
                this.staticHistogram.remove();
                //this.searchInformation.remove();
            } else {
                /*jshint -W035 */
                //this.searchInformation.remove();
            }
        }
    });

    cinema.viewMapper.registerView('parametric-chart-stack', 'view', cinema.views.ChartView, {
        controls: [
            //{ position: 'left', key: 'information', icon: 'icon-help', title: 'Information' },
            { position: 'right', key: 'tools', icon: 'icon-tools', title: 'Tools' }
        ]
    });

    cinema.viewMapper.registerView('parametric-chart-stack', 'search', cinema.views.ChartSearchView, {
        controls: [
            //{ position: 'left', key: 'information', icon: 'icon-help', title: 'Information' },
            //{ position: 'right', key: 'tools', icon: 'icon-tools', title: 'Tools' }
        ]
    });

}());
