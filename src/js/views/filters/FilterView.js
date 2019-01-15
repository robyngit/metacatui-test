/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/Filter',
        'text!templates/filters/filter.html'],
  function($, _, Backbone, Filter, Template) {
  'use strict';

  // Render a view of a single FilterModel
  var FilterView = Backbone.View.extend({

    // @type {Filter} - A Filter model to be rendered in this view
    model: null,

    tagName: "div",

    className: "filter",

    template: _.template(Template),

    events: {
      "click .btn"     : "handleChange",
      "keypress input" : "handleTyping"
    },

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new Filter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );
    },

    /*
    * When the user presses Enter in the input element, update the view and model
    *
    * @param {Event} - The DOM Event that occured on the filter view input element
    */
    handleTyping: function(e){

      if (e.keyCode != 13){
        return;
      }

      this.handleChange();

    },

    /*
    * Updates the view when the filter input is updated
    *
    * @param {Event} - The DOM Event that occured on the filter view input element
    */
    handleChange: function(){

      this.updateModel();

      //Clear the value of the text input
      this.$("input").val("");

    },

    /*
    * Updates the value set on the Filter Model associated with this view.
    * The filter value is grabbed from the input element in this view.
    *
    */
    updateModel: function(){

      //Get the new value from the text input
      var newValue = this.$("input").val();

      //Get the current values array from the model
      var currentValue = this.model.get("values");

      //Replace the first index of the array with the new value
      var newValuesArray = currentValue.slice(0);
      newValuesArray[0] = newValue;

      //Trigger the change event manually since it is an array
    //  this.model.trigger("change:values", this.model, currentValue);
      this.model.set("values", newValuesArray);

    }

  });
  return FilterView;
});
