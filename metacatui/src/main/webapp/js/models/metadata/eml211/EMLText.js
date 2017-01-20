/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLText = Backbone.Model.extend({
		
		type: "EMLText",
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			text: [], //The text content
			hasChanged: false
		},
		
		initialize: function(attributes){
			if(attributes.objectDOM) this.set(this.parse(attributes.objectDOM));

		},

		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
		nodeNameMap: function(){
			return{

			}
		},
		
		parse: function(objectDOM){
			if(!objectDOM)
				var objectDOM = this.get("objectDOM").cloneNode(true);
			
			var paragraphs = [];
			
			//Get the direct children of this text element and save them as paragraphs - ignore any nested formatting elements for now
			//TODO: Support more detailed text formattin
			_.each(objectDOM.children, function(childEl){

				paragraphs.push(childEl.textContent);
				
			}, this);
			
			var modelJSON = {
				text: paragraphs
			}
			
			return modelJSON;
		},
		
		serialize: function(){
			var objectDOM = this.updateDOM(),
				xmlString = objectDOM.outerHTML;
		
			//Camel-case the XML
	    	xmlString = this.formatXML(xmlString);
    	
	    	return xmlString;
		},
		
		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			 var objectDOM = this.get("objectDOM").cloneNode(true);
			 
			 //Empty the DOM
			 $(objectDOM).empty();
			 
			 //Format the text
			 var paragraphs = this.get("text");
			 _.each(paragraphs, function(p){
				$(objectDOM).append("<para>" + p + "</para>");
			 });
			 
			 return objectDOM;
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLText;
});