/*global define */
define(['jquery', 'underscore', 'backbone', 'moment', 'models/SolrResult', 'views/CitationView', 'text!templates/resultsItem.html'], 				
	function($, _, Backbone, moment, SolrResult, CitationView, ResultItemTemplate) {
	
	'use strict';

	// SearchResult View
	// --------------

	// The DOM element for a SearchResult item...
	var SearchResultView = Backbone.View.extend({
		tagName:  'div',
		className: 'row-fluid result-row pointer',

		// Cache the template function for a single item.
		//template: _.template($('#result-template').html()),
		template: _.template(ResultItemTemplate),

		// The DOM events specific to an item.
		events: {
			'click .result-selection' : 'toggleSelected',
			'click'                   : 'routeToMetadata'
		},

		// The SearchResultView listens for changes to its model, re-rendering. Since there's
		// a one-to-one correspondence between a **SolrResult** and a **SearchResultView** in this
		// app, we set a direct reference on the model for convenience.
		initialize: function () {
			this.listenTo(this.model, 'change', this.render);
			this.listenTo(this.model, 'reset', this.render);
			//this.listenTo(this.model, 'destroy', this.remove);
			//this.listenTo(this.model, 'visible', this.toggleVisible);
		},

		// Re-render the citation of the result item.
		render: function () {
			//Convert the model to JSON and create the result row from the template
			var json = this.model.toJSON();
			json.hasProv  = this.model.hasProvTrace();
			json.memberNode = _.findWhere(nodeModel.get("members"), {identifier: this.model.get("datasource")});
				
			var resultRow = this.template(json);
			this.$el.html(resultRow);
			
			//Create the citation
			var citation = new CitationView({metadata: this.model}).render().el;
			var placeholder = this.$(".citation");
			if(placeholder.length < 1) this.$el.append(citation);
			else $(placeholder).replaceWith(citation);
			
			//Create the OpenURL COinS
			var span = this.getOpenURLCOinS();
			this.$el.append(span);
						
			//Save the id in the DOM for later use
			var id = json.id;
			this.$el.attr("data-id", id);
			
				//If this object has a provenance trace, we want to display information about it
				if(json.hasProv){
					
					var numSources = this.model.get("prov_hasSources"),
						numDerivations = this.model.get("prov_hasDerivations");
					
					//Create the title of the popover 
					/*if(numSources) title += " was created using source";
					if(numSources > 1) title += "s";
					if(numSources > 0 &amp;&amp; numDerivations > 0) title += " and";
					if(numDerivations > 0) title += " has been used by " + numDerivations + " other dataset";
					if(numDerivations > 1) title += "s";
					title += ".";
									*/
					if(numDerivations || numSources) var title = "This dataset contains provenance information";
					
					//Make a tooltip with basic info for mouseover
					this.$el.find(".provenance.active").tooltip({
						placement: "top",
						trigger: "hover",
						container: this.el,
						title: title
					});	
				}
				
			if(this.model.get("abstract")){
				var abridgedAbstract = (this.model.get("abstract").indexOf(" ", 250) < 0) ? this.model.get("abstract") : this.model.get("abstract").substring(0, this.model.get("abstract").indexOf(" ", 250)) + "...";
				var content = $(document.createElement("div"))
								.append($(document.createElement("p")).text(abridgedAbstract));
												
				this.$(".popover-this.abstract").popover({
					trigger: "hover",
					html: true,
					content: content,
					title: "Abstract",
					placement: "top",
					container: this.el
				});
			}
			else{
				this.$(".popover-this.abstract").addClass("inactive");
				this.$(".icon.abstract").addClass("inactive");
			}
			
			return this;
		},

		// Toggle the `"selected"` state of the model.
		toggleSelected: function () {
			this.model.toggle();
		},
		
		routeToMetadata: function(e){	
			var id = this.model.get("id");
			
			//If the user clicked on a download button or any element with the class 'stop-route', we don't want to navigate to the metadata
			if ($(e.target).hasClass('stop-route') || (typeof id === "undefined") || !id)
				return;
			
			uiRouter.navigate('view/'+id, {trigger: true});
		},
		
		getOpenURLCOinS: function(){
			//Create the OpenURL COinS 
			var spanTitle = "ctx_ver=Z39.88-2004&amp;rft_val_fmt=info:ofi/fmt:kev:mtx:dc&amp;rfr_id=info:sid/ocoins.info:generator&amp;rft.type=Dataset";

			if(this.model.get("title")) 	 spanTitle += "&amp;rft.title=" + this.model.get("title");
			if(this.model.get("origin")) 	 spanTitle += "&amp;rft.creator=" + this.model.get("origin");
			if(this.model.get("keywords")) 	 spanTitle += "&amp;rft.subject=" + this.model.get("keywords");
			if(this.model.get("abstract")) 	 spanTitle += "&amp;rft.description=" + this.model.get("abstract");
			if(this.model.get("datasource")) spanTitle += "&amp;rft.publisher=" + this.model.get("datasource");
			if(this.model.get("endDate")) 	 spanTitle += "&amp;rft.date=" + this.model.get("endDate");
			if(this.model.get("formatID")) 	 spanTitle += "&amp;rft.format=" + this.model.get("formatID");
			if(this.model.get("id"))         spanTitle += "&amp;rft.identifier=" + this.model.get("id");
			if(this.model.get("url")) 		 spanTitle += "&amp;rft.source=" + this.model.get("url");
			if(this.model.get("northBoundCoord")){					
				spanTitle += "&amp;rft.coverage=POLYGON((" + this.model.get("southBoundCoord") + " " + this.model.get("westBoundCoord") + ", " + 
														     this.model.get("northBoundCoord") + " " + this.model.get("westBoundCoord") + ", " +
														     this.model.get("northBoundCoord") + " " + this.model.get("eastBoundCoord") + ", " +
														     this.model.get("southBoundCoord") + " " + this.model.get("eastBoundCoord") + "))";
			}
			
			spanTitle = encodeURI(spanTitle);
			
			return $(document.createElement("span")).attr("title", spanTitle).addClass("Z3988");
		},

		// Remove the item, destroy the model from *localStorage* and delete its view.
		clear: function () {
			this.model.destroy();
		},
		
		onClose: function(){
			this.clear();
		}
	});
	return SearchResultView;
});
