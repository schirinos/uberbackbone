// UberBackbone
(function (factory) {

  // Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'backbone', 'exports'], factory);
  }

  // Next for Node.js or CommonJS.
  else if (typeof exports === 'object') {
    factory(require('underscore'), require('backbone'), exports);
  }

  // Finally, as a browser global.
  else {
    factory(_, Backbone, {});
  }

}(function (_, Backbone, UberBackbone) {

    /**
     * Automatically attaches child views when instantiated by calling <b>attachChildViews</b>
     * @constructor
     * @alias module:app/views/base
     * @param {Object} options To specify child views. Pass a views object under the "views" key to the options object.
     * The views object should be key value pairs where the key is a css selector (ex: .main) and the value is instance of a Backbone view.
     * <br /> `Ex: var myView = new BaseView(views : {'.main':new BakeView()});`
     */
    UberBackbone.View = Backbone.View.extend({
        /**
         * Holds child views attached to different areas of the template
         * specified by a selector.
         * @type {Object}
         */
        views: {},
        /**
         * Options for animation on the view
         * @type {Object}
         */
        animate: {},
        /**
         * The template for the view
         * @type {Object}
         */
        template: {},
        /**
         * The template for the view
         * @type {Object}
         */
        tplLoading: _.template('<div data-loading-msg class="progress progress-striped active text-center"><div class="progress-bar"  role="progressbar" style="width: 100%;"></div></div>'),
        /**
         * The template for the view
         * @type {Object}
         */
        tplAlert: _.template('<div class="alert alert-danger" data-alert-msg><button type="button" class="close" data-dismiss="alert">&times;</button><i class="icon-warning-sign"></i></div>'),
        /**
         * The template for the view
         * @type {Object}
         */
        tplInfo: _.template('<div class="alert alert-info" data-info-msg><button type="button" class="close" data-dismiss="alert">&times;</button><i class="icon-info-sign"></i></div>'),
        /**
         * Automatically called upon object construction
         */
        initialize: function (options) {
            // need to init local copy of child view
            // object to maintain proper protype chain
            this.views = {};

            // Merge selected options into object
            this.mergeOpts(options, ['views', 'animate', 'template']);

            // Attach the view's template
            this._attachTemplate();

            // Generate a deferred for the view to update
            // when rendering is complete and the view has been added
            // to the DOM.
            this._rendering = $.Deferred();

            // Generate a promise object for outsiders to
            // track when this view is added to the DOM.
            this.rendering = this._rendering.promise();

            // Cache bind elements as jQuery objects
            this.cacheBindRegions();

            // Attach child views specified in the constructor
            this.attachChildViews();
        },
        /**
         * Iterates through child views passed into constructor options and attaches them to the object.
         * Keys are based on the selector
         */
        attachChildViews: function() {
            if (this.views) {
                // Iterate through child view definitions and attachs to views object
                for(var selector in this.views) {
                    // Attach child view
                    this.attachView(this.views[selector], selector);
                }
            }
        },
        /**
         * Attach a child view
         * @param {Object} view The view object
         * @param {String} selector The CSS selector in the parent view markup to render the child view to
         */
        attachView: function(view, selector) {
            // Are we attaching the view to a certain selector in the parent view's template
            if (selector) {
                // Store reference to view, using the selector as the index
                this.views[selector] = view;
            } else {
                // Empty selector means we don't track as a normal child view.
                // But we still need to cleanup these created views, when the parent is cleaned up.
                // So have the view listen to the parent view's cleanup method in order to know when to clean itself up
                view.listenTo(this, "cleanUp", view.cleanUp);
            }

            // for chaining
            return this;
        },
        /**
         * Destroy view and remove it from DOM. Optionally animate the removal
         * @param {Object} options Options passed to the cleanup, such as animation settings
         */
        cleanUp: function (options) {
            // Merge view options with options arguments
            options = _.extend({}, {animate: this.animate}, options);

            // Fire cleanUp event for the view.
            // Child views that are attached without references in the
            // "views" property are cleaned up this way, because they just listen to
            // the cleanup event of their parent.
            // We need to force the child views listening to not to animate
            // because we can't figure out when animation is finished.
            // NOTE: We probably could somehow figure out the animation, but it is not neccessary as of yet...
            this.trigger('cleanUp', {animate: {cleanUp: false}});

            // Init array to store deffered objects of the child views
            // in case they have animated cleanup. Those without animated cleanup
            // will just returned resolved deffered objects.
            var childq = [];

            // Do we have child views attached to certain selectors?
            if (this.views) {
                // Iterate through child views
                for (var n in this.views) {
                    // Call cleanup and add deffered objects to the array
                    childq.push(this.views[n].cleanUp());
                }
            }

            // For callbacks
            var self = this;

            // We remove this view onl when child views cleanup animations are complete.
            // At the same time we return the deffered object of this view, so the caller
            // knows when this view's cleanup is complete.
            return $.when.apply($, childq).then(function (){

                // Are we animating cleanup of this view
                if (options.animate && options.animate.cleanUp) {
                    // TODO: Ability to specify more animations
                    // Fade out view
                    //self.$el.fadeOut('fast');

                    // NOTE: May cause flickering on some Safari,
                    // see the webkit-backface-visibility hack
                    // Use CSS3 Fade transitions
                    self.$el.transition({opacity:0});
                }

                // Remove the view from the DOM once any animation is complete
                // this also passes up the deffered object through the chain
                // so that to the caller so it knows when all animation is complete.
                return self.$el.promise().done(function () {
                    // Remove the view
                    self.remove();
                });
            });
        },
        /**
         * Called before the template is attached to the view.
         * You could override or munge the template before it is attached ot the view in this step.
         */
        preTemplate: function() {

        },
        /**
         * Called before the main rendering logic takes place, but after the template is attached
         */
        preRender: function() {

        },
        /**
         * Called after the main rendering logic takes place
         */
        postRender: function() {

        },
        /**
         * Attaches the template to the view
         */
        _attachTemplate: function() {
            // Pre template attachment actions
            this.preTemplate();

            // Check to see if template was compiled by seeing if it is a function
            if (_.isFunction(this.template)) {
                // Is a model set on the view?
                if (this.model) {
                    // Create new dom element, and insert the template as innerhtml
                    var new_elem = document.createElement('div');
                    new_elem.innerHTML = this.template(this.model.toJSON());

                    // Extract the first child of the dom element and use it as the view's new root element
                    this.setElement(new_elem.firstChild);

                    // Generate a bindings array from template markup
                    // and merge with the views set binding
                    this.createStickitBindings();
                } else {
                    // Create new dom element, and insert the template as innerhtml
                    var new_elem = document.createElement('div');
                    new_elem.innerHTML = this.template();

                    // Extract the first child of the dom element and use it as the view's new root element
                    this.setElement(new_elem.firstChild);
                }
            }
        },
        /**
         * Render the view to the DOM. Rendering happens in top down fashion with the base view being added to the DOM first then each subsequent child.
         * @param {Object} domEl Passing a dom element will render the view to this element instead.
         * @param {Object} options Options for rendering
         * @returns this for chaining
         */
        render: function(domEl, options) {
            // Setup model view binding
            if (this.model) this.stickit();

            // For callbacks
            var self = this;

            // After template is attached but before view is added to DOM actions.
            this.preRender();

            // Was there a dom element passed we should immediately attach to?
            // Do we animate the render portion?
            if (domEl && this.animate && this.animate.render) {
                // First we hide the view element
                this.$el.css('opacity', 0);

                // Do we replace the entire contents of the DOM element
                if (options && options.replace) {
                    $(domEl).html(this.$el);
                }
                // Otherwise just append into the DOM element
                else {
                    // Prepend?
                    if (options && options.prepend) {
                        this.$el.prependTo(domEl);
                    } else {
                        this.$el.appendTo(domEl);
                    }
                }

                // Regular jquery dom animaton
                this.$el.fadeIn('slow').done(function () {
                    // Notify that we have rendered the main view template.
                    // Use setTimeout to allow browser animation loop to catch up
                    // so that we get proper info from things like inspecting height and width of
                    // DOM elements
                    setTimeout(function() {
                        self._rendering.notifyWith(this, 'main');
                    }, 0);
                });
            }

            // Append to dom without animation
            else if (domEl) {
                // Do we replace the entire contents of the DOM element
                if (options && options.replace) {
                    $(domEl).html(this.$el);
                }
                // Otherwise just append to the DOM element
                else {
                    // Prepend?
                    if (options && options.prepend) {
                        this.$el.prependTo(domEl);
                    } else {
                        this.$el.appendTo(domEl);
                    }
                }

                // Notify that we have rendered the main view template.
                // Use setTimeout to allow browser animation loop to catch up
                // so that we get proper info from things like inspecting height and width of
                // DOM elements
                setTimeout(function() {
                    self._rendering.notifyWith(this, 'main');
                }, 0);
            }

            // For callbacks
            var self = this;

            // Only try to perform post render actions
            // when we know animation has completed.
            // By attaching to the done callback of the promise object
            // for the view's DOM element, it will be fired when animation is complete
            // or immediately if no animation was done.
            this.$el.promise().done(function () {
                // We start rendering child views once the
                // main view is rendered.
                self.renderChildren();

                // Resolve the view's rendering deferred
                // in order to alert any watchers that the view has finished rendering.
                // Do within setTimeout to schedule withing natural browser repaint cycle.
                setTimeout(function() {
                    self._rendering.resolveWith(self);

                    // Post render actions take place after we render each child
                    self.postRender();
                }, 0);
            });

            // For chaining
            return this;
        },
        /**
         * Render a specific child view to DOM
         * @param {Object} selector A css selector used to find the dom elemnt to render to within the parent container
         * @param {Object} options Options passed to the render function
         */
        renderChild: function(selector, options) {
            // Check if child views is available
            if (this.views[selector]) {
                // Render view into the selector area of the parent view
                this.views[selector].render(this.$(selector)[0], options);
            }
        },
        /**
         * Render child views to DOM
         */
        renderChildren: function() {
            // Check if child views were set and render child views
            if(this.views) {
                for(var selector in this.views) {
                    this.renderChild(selector);
                }
            }
        },
        /**
         * Hide loading graphic
         * @param {Object} [animate] Animation settings for hiding loading graphic
         */
        hideLoading: function (animate) {
            // Are we animating?
            if (animate) {
                // remove loading bar from dom
                this.$('[data-loading-msg]').fadeOut(function () {
                    $(this).remove();
                });
            } else {
                // remove loading bar from dom
                this.$('[data-loading-msg]').remove();
            }
        },
        /**
         * Show the loading graphic
         * @param {String} [msgText] The message to display in the loading graphic
         */
        showLoading: function (msgText) {
            // Remove existing loading graphic
            this.hideLoading();

            // Compile template to html
            var html = this.tplLoading({msg: msgText});

            // If we see this tag then we insert the loading message as its next sibiling
            var tag = this.$('[data-loading-location]');
            if (tag[0]) {
                tag.after(html);

            // Otherwise we just attach it to top of template
            } else {
                this.$el.prepend(html);
            }
        },
        /**
         * Hide alert box
         * @param {Object} [animate] Animation settings for hiding alert box
         */
        hideAlert: function (animate) {
            // Are we animating?
            if (animate) {
                // remove alert box from dom
                this.$('[data-alert-msg]').fadeOut(function () {
                    $(this).remove();
                });
            } else {
                // remove alert box from dom
                this.$('[data-alert-msg]').remove();
            }
        },
        /**
         * Show alert message
         * @param {String} [msgText] The message to display in the alert area
         */
        showAlert: function (msgText) {
            // Remove existing alert message
            this.hideAlert();

            // If we see a this tag then we insert the loading message as its next sibiling
            var tag = this.$('[data-alert-location]');
            if (tag[0]) {
                tag.after(this.tplAlert({msg: msgText}));

            // Otherwise we just attach it to top of template
            } else {
                this.$el.prepend(this.tplAlert({msg: msgText}));
            }
        },
        /**
         * Hide info message
         * @param {Object} [animate] Animation settings for hiding alert box
         */
        hideInfo: function (animate) {
            // Are we animating?
            if (animate) {
                // remove info box from dom
                this.$('[data-info-msg]').fadeOut(function () {
                    $(this).remove();
                });
            } else {
                // remove info box from dom
                this.$('[data-info-msg]').remove();
            }
        },
        /**
         * Show info message
         * @param {String} [msgText] The message to display in the alert area
         * @param {Integer} [timeout] Number of milliseconds in which to automatically fadeout the info box.
         */
        showInfo: function (msgText, timeout) {
            // Remove existing
            this.hideInfo();

            // If we see a data-msg-info tag then we insert the message as its next sibiling
            var tag = this.$('[data-info-location]');
            if (tag[0]) {
                tag.after(this.tplInfo({msg: msgText}));

            // Otherwise we just attach it to top of template
            } else {
                this.$el.prepend(this.tplInfo({msg: msgText}));

                // For callbacks
                var self = this;

                // Do we have auto removal set?
                if (timeout > 0) {
                    setTimeout(function () {
                        self.hideInfo(true);
                    }, timeout);
                }
            }
        },
        /**
         * Shows a popover for a target element.
         * @param {Object} elem The dom element to attach popover to
         * @param {Integer} timeout The number of milliseconds before the popover should autmatically fade out
         * @param {Object} options Options to pass to popover call
         */
        showPopover: function(elem, timeout, options) {
            // Initialize popover
            $(elem).popover(
                $.extend({
                    trigger: "manual",
                    placement: "left",
                    html: true,
                    content: '<span class="text-error">Action failed, try again.</span>'
                }, options)
            );

            // Show popover
            $(elem).popover('show');

            // Fade out popover after timeout period
            if (timeout && elem) {
                setTimeout(function () {
                    // We need to check if the element exists
                    // before we destory the popover or we crash the browser.
                    if ($(elem)[0]) {
                       $(elem).popover('destroy');
                   }
                }, timeout);
            }
        },
        /**
         * Your views should override this method when needed. Use as a convenience function to
         * fetch data from an attached model or collection while showing something in the UI to indicate waiting.
         * You can use the built in showLoading/hideLoading functions to facillitate this.
         */
        refresh: function () {},
        /**
         * Create cached jQuery objects from all "data-region" tags to use later.
         */
        cacheBindRegions: function () {
            // For callbacks
            var self = this;

            // Iterate through the "data-bind" tags
            this.$('[data-bind]').each(function (idx, elem) {
                // Cache a copy of the jquery object for that element
                self["$"+$(this).data("bind")] = $(this);

                // Attach the more precise selector, since it is lost by rewrapping element directly in jquery function ie: $(this)
                self["$"+$(this).data("bind")].selector = this.tagName.toLowerCase() + '[data-bind="' + $(this).data("bind") + '"]';
            });
        },
        /**
         * Create stickit bindings from data-stickit attributes in the HTML and merge
         * with any set on the view.
         *
         * You can specify a binding definition as a json string in the attribute.
         * ex: data-stickit='{".item": {"attributes":[{"name": "href", "observe": "service_url"}]}}'
         */
        createStickitBindings: function () {
            // Init empty bindings
            var bindings = {};

            // Iterate through the "data-stickit" attributes to generate
            // stickit bindings for the view.
            this.$('[data-stickit]').each(function (idx, elem) {

                // Get stickit binding definition
                // NOTE: jQuery data() will parse value
                // automatically as json string into an object
                var stickit = $(this).data('stickit');

                // Allow short-hand binding definition.
                // Numbers need to be cast to Strings for stickit to properly wireup
                if (_.isString(stickit) || _.isNumber(stickit)) {
                    bindings['[data-stickit="'+stickit+'"]'] = String(stickit);
                } else {
                    bindings = _.extend(bindings, stickit);
                }
            });

            // Add the stickit bindings generated from markup attributes to the ones already set in the
            // view code. Binding keys already set in view code will not be overwritten by markup generated bindings.
            this.bindings = _.defaults(this.bindings, bindings);
        },
        /**
         * Merge a specified set of options from the passed options object with properties on this object.
         * @param {Object} options The options to pick from when merging.
         * @param {Array} mergeOpts The option names to merge.
         */
        mergeOpts: function (options, mergeOpts) {
            // Make sure options is set to something
            options = options || {};

            // Merge the specified passed options with this object
            _.extend(this, _.pick(options, mergeOpts));
        },
        /**
         * Takes an event object and calls prevent default and stopPropogation on it to block the events from bubbling.
         * @param {object} e The event object for fired event
         */
        blockEvents: function (e) {
            // Do we have an event object
            if (e) {
                // Prevent default browser action
                e.preventDefault();
                e.stopPropagation();

                if (e.gesture) {
                    e.gesture.preventDefault();
                    e.gesture.stopPropagation();
                }

                // Blocking events was called without problems
                return true;
            } else {
                // There was no event object so blocking failed
                return false;
            }
        },
        /**
         * Takes an event object and call stopPropogation on it to block the events from bubbling.
         * @param {object} e The event object for fired event
         */
        blockProp: function (e) {
            // Do we have an event object
            if (e) {
                // Prevent default browser action
                e.stopPropagation();

                if (e.gesture) {
                    e.gesture.stopPropagation();
                }

                // Blocking events was called without problems
                return true;
            } else {
                // There was no event object so blocking failed
                return false;
            }
        },
        /**
         * Prevents default action on the passed event object
         * @param {object} e The event object for fired event
         */
        blockDefault: function (e) {
            // Do we have an event object
            if (e) {
                // Prevent default browser action
                e.preventDefault();

                if (e.gesture) {
                    e.gesture.preventDefault();
                }

                // Was called without problems
                return true;
            } else {
                // There was no event object so it failed
                return false;
            }
        },
        /**
         * Swap a child view from a region with a new view
         * @param {Object} newView The new view to display
         */
        swapView: function (selector, newView) {
            // For callbacks
            var self = this;

            // Check if we have a view for this selector already
            if (this.views[selector]) {
                // Clean up the most recently swapped out view
                this.views[selector].cleanUp().done(function () {
                    // Attach view as child and render it, replacing anything that might be there before
                    self.attachView(newView, selector).renderChild(selector, {replace:true});
                });
            } else {
                // Attach view as child and render it, replacing anything that might be there before
                this.attachView(newView, selector).renderChild(selector, {replace:true});
            }

            // Since swaping could take some time due to animation callbacks
            // we return the promise object of the old view so our
            // calling function knows when the view has been swapped and rendered to the page
            return this.views[selector].$el.promise();

        }
    });

    /**
     * @constructor
     * @alias module:views/list
     * @param {Object} options Initialization options
     */
    UberBackbone.ListView = UberBackbone.View.extend({
        /**
         * String to generate filter regular expression from
         */
        filter : null,
        /**
         * Name of the property to filter on
         */
        filterName : null,
        /**
         * Wire up events
         */
        events : {
            'click [data-action="sort"]' : 'actionSort'
        },
        /**
         * Automatically called upon object construction
         */
        initialize: function (options) {
            // Call parent to to setup stuff
            BaseView.prototype.initialize.apply(this, arguments);

            // Merge certain options
            this.mergeOpts(options, ['itemView', 'template']);

            // Listen for collection events
            this.listenTo(this.collection, 'add', this.addItem);
            this.listenTo(this.collection, 'reset', this.resetItems);
            this.listenTo(this.collection, 'sort', this.resetItems);

            // Refresh our list
            this.refresh();
        },
        /**
         * Toggles sort direction on the collection
         */
        actionSort: function (e) {
            this.collection.setSort(null, $(e.currentTarget).attr('data-sort-key'), true);
        },
        /**
         * Add an item
         * @param {Object} model Model added to the collection
         * @param {Object} collection The collection model was added to
         * @param {Object} options Options passed to the add event
         */
        addItem: function (model, collection, options) {
            var view = new this.itemView({model: model});
            this.$list.append(view.render().el);
        },
        /**
         * Reset the items
         * @param {Object} collection The collection model was added to
         * @param {Object} options Options passed to the add event
         */
        resetItems: function (collection, options) {
            // Empty the services list
            this.$list.empty();

            // For callbacks
            var self = this;

            // Do we have filter criteria set?
            if (this.filter && this.filterName) {
                var filterRegex = new RegExp(this.filter,'gi');
            }

            // Iterate through collection
            _.each(collection.models, function (item, idx, list){
                // Is there a filter set?
                if (filterRegex) {
                    if (item.get(self.filterName).match(filterRegex)) {
                        self.addItem(item, list, options);
                    }
                } else {
                    self.addItem(item, list, options);
                }
            });
        },
        /**
         * Refresh the view data
         */
        refresh: function (model, collection, options) {
            // show loading
            this.showLoading('Loading');

            // For callbacks
            var self = this;

            // Get data from server
            this.collection.fetch({reset: true})
            .always(function () {
                self.hideLoading();
            })
            .done(function () {
                self.collection.sort();
            })
            .fail(function () {
            });
        }
    });


    /**
     * Constructor
     * @constructor
     */
    var _delayedTriggers = [],
        nestedChanges;

    UberBackbone.Model = Backbone.Model.extend({
        /**
         * The options passed to the function
         * @type {Object}
         */
        options : {},
        /**
         * Merge a specified set of options from the passed options object with properties on this object.
         * @param {Object} options The options to pick from when merging.
         * @param {Array} mergeOpts The option names to merge.
         */
        mergeOpts: function (options, mergeOpts) {
            // Merge some passed options with default options
            _.extend(this, _.pick(_.extend({}, options), mergeOpts));
        },
        get: function(attrStrOrPath){
            var attrPath = UberBackbone.Model.attrPath(attrStrOrPath),
                result;

            UberBackbone.Model.walkPath(this.attributes, attrPath, function(val, path){
                var attr = _.last(path);
                if (path.length === attrPath.length){
                    // attribute found
                    result = val[attr];
                }
            });

            return result;
        },

        has: function(attr){
            // for some reason this is not how Backbone.Model is implemented - it accesses the attributes object directly
            var result = this.get(attr);
            return !(result === null || _.isUndefined(result));
        },

        set: function(key, value, opts){
            var newAttrs = UberBackbone.Model.deepClone(this.attributes),
                attrPath,
                unsetObj,
                validated;

            if (_.isString(key)){
                // Backbone 0.9.0+ syntax: `model.set(key, val)` - convert the key to an attribute path
                attrPath = UberBackbone.Model.attrPath(key);
            } else if (_.isArray(key)){
                // attribute path
                attrPath = key;
            }

            if (attrPath){
                opts = opts || {};
                this._setAttr(newAttrs, attrPath, value, opts);
            } else { // it's an Object
                opts = value || {};
                var attrs = key;
                for (var _attrStr in attrs) {
                    if (attrs.hasOwnProperty(_attrStr)) {
                        this._setAttr(newAttrs,
                                                    UberBackbone.Model.attrPath(_attrStr),
                                                    opts.unset ? void 0 : attrs[_attrStr],
                                                    opts);
                    }
                }
            }

            nestedChanges = UberBackbone.Model.__super__.changedAttributes.call(this);

            if (opts.unset && attrPath && attrPath.length === 1){ // assume it is a singular attribute being unset
                // unsetting top-level attribute
                unsetObj = {};
                unsetObj[key] = void 0;
                nestedChanges = _.omit(nestedChanges, _.keys(unsetObj));
                validated = UberBackbone.Model.__super__.set.call(this, unsetObj, opts);
            } else {
                unsetObj = newAttrs;

                // normal set(), or an unset of nested attribute
                if (opts.unset && attrPath){
                    // make sure Backbone.Model won't unset the top-level attribute
                    opts = _.extend({}, opts);
                    delete opts.unset;
                } else if (opts.unset && _.isObject(key)) {
                    unsetObj = key;
                }
                nestedChanges = _.omit(nestedChanges, _.keys(unsetObj));
                validated = UberBackbone.Model.__super__.set.call(this, unsetObj, opts);
            }


            if (!validated){
                // reset changed attributes
                this.changed = {};
                nestedChanges = {};
                return false;
            }


            this._runDelayedTriggers();
            return this;
        },

        unset: function(attr, options) {
            return this.set(attr, void 0, _.extend({}, options, {unset: true}));
        },

        clear: function(options) {
            nestedChanges = {};

            // Mostly taken from Backbone.Model.set, modified to work for NestedModel.
            options = options || {};
            // clone attributes so validate method can't mutate it from underneath us.
            var attrs = _.clone(this.attributes);
            if (!options.silent && this.validate && !this.validate(attrs, options)) {
                return false; // Should maybe return this instead?
            }

            var changed = this.changed = {};
            var model = this;

            var setChanged = function(obj, prefix, options) {
                // obj will be an Array or an Object
                _.each(obj, function(val, attr){
                    var changedPath = prefix;
                    if (_.isArray(obj)){
                        // assume there is a prefix
                        changedPath += '[' + attr + ']';
                    } else if (prefix){
                        changedPath += '.' + attr;
                    } else {
                        changedPath = attr;
                    }

                    val = obj[attr];
                    if (_.isObject(val)) { // clear child attrs
                        setChanged(val, changedPath, options);
                    }
                    if (!options.silent) model._delayedChange(changedPath, null, options);
                    changed[changedPath] = null;
                });
            };
            setChanged(this.attributes, '', options);

            this.attributes = {};

            // Fire the `"change"` events.
            if (!options.silent) this._delayedTrigger('change');

            this._runDelayedTriggers();
            return this;
        },

        add: function(attrStr, value, opts){
            var current = this.get(attrStr);
            if (!_.isArray(current)) throw new Error('current value is not an array');
            return this.set(attrStr + '[' + current.length + ']', value, opts);
        },

        remove: function(attrStr, opts){
            opts = opts || {};

            var attrPath = UberBackbone.Model.attrPath(attrStr),
                aryPath = _.initial(attrPath),
                val = this.get(aryPath),
                i = _.last(attrPath);

            if (!_.isArray(val)){
                throw new Error("remove() must be called on a nested array");
            }

            // only trigger if an element is actually being removed
            var trigger = !opts.silent && (val.length >= i + 1),
                oldEl = val[i];

            // remove the element from the array
            val.splice(i, 1);
            opts.silent = true; // Triggers should only be fired in trigger section below
            this.set(aryPath, val, opts);

            if (trigger){
                attrStr = UberBackbone.Model.createAttrStr(aryPath);
                this.trigger('remove:' + attrStr, this, oldEl);
                for (var aryCount = aryPath.length; aryCount >= 1; aryCount--) {
                    attrStr = UberBackbone.Model.createAttrStr(_.first(aryPath, aryCount));
                    this.trigger('change:' + attrStr, this, oldEl);
                }
                this.trigger('change', this, oldEl);
            }

            return this;
        },

        changedAttributes: function(diff) {
            var backboneChanged = UberBackbone.Model.__super__.changedAttributes.call(this, diff);
            if (_.isObject(backboneChanged)) {
                return _.extend({}, nestedChanges, backboneChanged);
            }
            return false;
        },

        toJSON: function(){
            return UberBackbone.Model.deepClone(this.attributes);
        },


        // private
        _delayedTrigger: function(/* the trigger args */){
            _delayedTriggers.push(arguments);
        },

        _delayedChange: function(attrStr, newVal, options){
            this._delayedTrigger('change:' + attrStr, this, newVal, options);

            // Check if `change` even *exists*, as it won't when the model is
            // freshly created.
            if (!this.changed) {
                this.changed = {};
            }

            this.changed[attrStr] = newVal;
        },

        _runDelayedTriggers: function(){
            while (_delayedTriggers.length > 0){
                this.trigger.apply(this, _delayedTriggers.shift());
            }
        },

        // note: modifies `newAttrs`
        _setAttr: function(newAttrs, attrPath, newValue, opts){
            opts = opts || {};

            var fullPathLength = attrPath.length;
            var model = this;

            UberBackbone.Model.walkPath(newAttrs, attrPath, function(val, path, next){
                var attr = _.last(path);
                var attrStr = UberBackbone.Model.createAttrStr(path);

                // See if this is a new value being set
                var isNewValue = !_.isEqual(val[attr], newValue);

                if (path.length === fullPathLength){
                    // reached the attribute to be set

                    if (opts.unset){
                        // unset the value
                        delete val[attr];

                        // Trigger Remove Event if array being set to null
                        if (_.isArray(val)){
                            var parentPath = UberBackbone.Model.createAttrStr(_.initial(attrPath));
                            model._delayedTrigger('remove:' + parentPath, model, val[attr]);
                        }
                    } else {
                        // Set the new value
                        val[attr] = newValue;
                    }

                    // Trigger Change Event if new values are being set
                    if (!opts.silent && _.isObject(newValue) && isNewValue){
                        var visited = [];
                        var checkChanges = function(obj, prefix) {
                            // Don't choke on circular references
                            if(_.indexOf(visited, obj) > -1) {
                                return;
                            } else {
                                visited.push(obj);
                            }

                            var nestedAttr, nestedVal;
                            for (var a in obj){
                                if (obj.hasOwnProperty(a)) {
                                    nestedAttr = prefix + '.' + a;
                                    nestedVal = obj[a];
                                    if (!_.isEqual(model.get(nestedAttr), nestedVal)) {
                                        model._delayedChange(nestedAttr, nestedVal, opts);
                                    }
                                    if (_.isObject(nestedVal)) {
                                        checkChanges(nestedVal, nestedAttr);
                                    }
                                }
                            }
                        };
                        checkChanges(newValue, attrStr);

                    }


                } else if (!val[attr]){
                    if (_.isNumber(next)){
                        val[attr] = [];
                    } else {
                        val[attr] = {};
                    }
                }

                if (!opts.silent){
                    // let the superclass handle change events for top-level attributes
                    if (path.length > 1 && isNewValue){
                        model._delayedChange(attrStr, val[attr], opts);
                    }

                    if (_.isArray(val[attr])){
                        model._delayedTrigger('add:' + attrStr, model, val[attr]);
                    }
                }
            });
        }

    }, {
        // class methods

        attrPath: function(attrStrOrPath){
            var path;

            if (_.isString(attrStrOrPath)){
                // TODO this parsing can probably be more efficient
                path = (attrStrOrPath === '') ? [''] : attrStrOrPath.match(/[^\.\[\]]+/g);
                path = _.map(path, function(val){
                    // convert array accessors to numbers
                    return val.match(/^\d+$/) ? parseInt(val, 10) : val;
                });
            } else {
                path = attrStrOrPath;
            }

            return path;
        },

        createAttrStr: function(attrPath){
            var attrStr = attrPath[0];
            _.each(_.rest(attrPath), function(attr){
                attrStr += _.isNumber(attr) ? ('[' + attr + ']') : ('.' + attr);
            });

            return attrStr;
        },

        deepClone: function(obj){
            return $.extend(true, {}, obj);
        },

        walkPath: function(obj, attrPath, callback, scope){
            var val = obj,
                childAttr;

            // walk through the child attributes
            for (var i = 0; i < attrPath.length; i++){
                callback.call(scope || this, val, attrPath.slice(0, i + 1), attrPath[i + 1]);

                childAttr = attrPath[i];
                val = val[childAttr];
                if (!val) break; // at the leaf
            }
        }

    });

    /**
     * Contructor
     * @constructor
     * @alias app/collections/base
     */
    UberBackbone.Collection = Backbone.Collection.extend({
        /**
         * The options passed to the function
         * @type {Object}
         */
        options : {},
        /**
         * Sort direction
         * @type {String}
         */
        sortDir : 'asc',
        /**
         * Property of the model to sort by
         * @type {String}
         */
        sortName : 'asc',
        /**
         * Merge a specified set of options from the passed options object with properties on this object.
         * @param {Object} options The options to pick from when merging.
         * @param {Array} mergeOpts The option names to merge.
         */
        mergeOpts: function (options, mergeOpts) {
            // Merge some passed options with default options
            _.extend(this, _.pick(_.extend({}, options), mergeOpts));
        },
        /**
         * The sort strategies availble for this collection
         * @param {String} dir The sort direction
         */
        strategies: function (dir) {
            if (dir === 'desc') {
                return function (prop) {
                    return function (model1, model2) {
                        if (model1.get(prop) > model2.get(prop)) return -1; // before
                        if (model2.get(prop) > model1.get(prop)) return 1; // after
                        return 0; // equal
                    }
                }
            } else {
                return function (prop) {
                    return function (model1, model2) {
                        if (model1.get(prop) > model2.get(prop)) return 1; // after
                        if (model1.get(prop) < model2.get(prop)) return -1; // before
                        return 0; // equal
                    }
                }
            }
        },
        /**
         * Change the sort comparator
         */
        setSort: function (dir, name, doSort) {
            // Toggle between asc and desc if no direction specified
            // and this is not our first sort on the particular property name
            // otherwise we just make the default 'asc' or whatever direction they passed in.
            if ((this.sortName === name) && !dir) {
                this.sortDir = (this.sortDir === 'asc') ? 'desc' : 'asc';
            } else {
                this.sortDir = dir || 'asc';
            }

            // Track the sort property
            this.sortName = name;

            // Default to not sort automatically
            doSort = doSort || false;

            // Set the comparator and fire off a sort
            this.comparator = this.strategies(this.sortDir)(this.sortName);

            // Should we fired off a sort right away
            if (doSort) this.sort();
        },
    });

    // Attach to Backbone object
    Backbone.UberView = UberBackbone.View
    Backbone.UberListView = UberBackbone.ListView
    Backbone.UberModel = UberBackbone.Model
    Backbone.UberCollection = UberBackbone.Collection

    // Export module
    return UberBackbone;
}));