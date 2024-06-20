"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "d3",
  "models/SolrResult",
  "DonutChart",
  "views/CitationView",
  "text!templates/mdqRun.html",
  "text!templates/loading-metrics.html",
  "collections/QualityReport",
], (
  $,
  _,
  Backbone,
  d3,
  SolrResult,
  DonutChart,
  CitationView,
  MdqRunTemplate,
  LoadingTemplate,
  QualityReport,
) => {


  // User facing messages used in this view
  const STRINGS = {
    notFound: "The assessment report for this dataset is not ready yet, it is in the queue to be generated. Try checking back in 24 hours to see these results.",
    error: "There was an error retrieving or generating the assessment report for this dataset."
  };

  /**
   * @class MdqRunView
   * @classdesc A view that fetches and displays a Metadata Assessment Report
   * @classcategory Views
   * @name MdqRunView
   * @augments Backbone.View
   * @constructs
   */
  const MdqRunView = Backbone.View.extend(
    /** @lends MdqRunView.prototype */ {

      /** @inheritdoc */
      el: "#Content",

      /** @inheritdoc */
      events: {
        "change #suiteId": "switchSuite",
      },

      /**
       * The URL of the Metacat Data Quality service
       * @type {string}
       */
      url: null,

      /**
       * The PID of the dataset to be assessed
       * @type {string}
       */
      pid: null,

      /**
       * The currently selected/requested suite
       * @type {string}
       */

      suiteId: null,

      /**
       * The list of all potential suites for this theme
       * @type {string[]}
       */
      suiteIdList: [],

      /**
       * The underscore.js template to use to show that content is loading
       * @type {Function}
       */
      loadingTemplate: _.template(LoadingTemplate),

      /**
       * The underscore.js template to use for this view
       * @type {Function}
       */
      template: _.template(MdqRunTemplate),

      /**
       * A JQuery selector for the element in the template that will contain the breadcrumbs
       * @type {string}
       */
      breadcrumbContainer: "#breadcrumb-container",

      /**
       * A JQuery selector for the element in the template that will contain the loading
       * image
       * @type {string}
       * @since 2.15.0
       */
      loadingContainer: "#mdqResult",

      initialize() {
        this.serviceUrl = MetacatUI.appModel.get("mdqRunsServiceUrl");
      },

      /**
       * Switch the suite to the one selected by the user
       * @param {Event} event The event that triggered this function
       * @returns {boolean} False, to prevent the default action of the event
       */
      switchSuite(event) {
        const select = $(event.target);
        const suiteId = $(select).val();
        const encodedPid = encodeURIComponent(this.pid);
        MetacatUI.uiRouter.navigate(
          `quality/s=${suiteId}/${encodedPid}`,
          { trigger: false },
        );
        this.suiteId = suiteId;
        this.render();
        return false;
      },

      /** @inheritdoc */
      render() {

        // Insert the basic template
        this.$el.html(this.template({}));

        // Show breadcrumbs leading back to the dataset & data search
        this.insertBreadcrumbs();

        if (!this.pid || !this.serviceUrl) {
          this.showNoPidMessage();
          return;
        }

        // The suite use for rendering can initially be set via the theme AppModel.
        // If a suite id is request via the metacatui route, then we have to display that
        // suite, and in addition have to display all possible suites for this theme in
        // a selection list, if the user wants to view a different one.
        if (!this.suiteId) {
          [this.suiteId] = MetacatUI.appModel.get("mdqSuiteIds");
        }

        this.suiteIdList = MetacatUI.appModel.get("mdqSuiteIds");
        this.suiteLabels = MetacatUI.appModel.get("mdqSuiteLabels");

        // Insert the loading image
        this.showLoading();

        const qualityReport = new QualityReport([], { pid: this.pid });
        this.qualityReport = qualityReport;
        this.setListeners();

        const qualityUrl = `${this.serviceUrl}${this.suiteId}/${this.pid}`;
        this.qualityReport.fetch({ url: qualityUrl });

      },

      /**
       * Show a message indicating that no PID was provided
       * @since 0.0.0
       */
      showNoPidMessage() {
        const searchLink = $(document.createElement("a"))
          .attr("href", `${MetacatUI.root}/data`)
          .text("Search our database");
        const message = $(document.createElement("span"))
          .text(" to see an assessment report for a dataset")
          .prepend(searchLink);
        this.showMessage(message, true, false);
      },


      setListeners() {
        this.listenToOnce(this.qualityReport, "fetchError", this.handleFetchError);
        this.listenToOnce(this.qualityReport, "fetchComplete", this.handleFetchComplete);
      },

      removeListeners() {
        this.stopListening(this.qualityReport);
      },

      /**
       * Inspect the results to see if a quality report was returned. If not,
       * then submit a request to the quality engine to create the quality
       * report for this pid/suiteId, and inform the user of this.
       * @param {QualityReport} qualityReport The quality report collection
       */
      handleFetchError() {

        const { qualityReport } = this;
        this.removeListeners();

        let msgText;
        const { runStatus, timestamp, fetchResponse } = qualityReport;
        const { status } = fetchResponse;
        const statusText = qualityReport.errorDescription || fetchResponse.statusText;

        if (status === 404 || runStatus === "queued") {
          msgText = STRINGS.notFound;
          if (timestamp) {
            msgText += ` The report was requested at: ${timestamp}`;
          }
        } else {
          msgText = STRINGS.error;
          if (statusText) {
            msgText += `The Assessment Server reported this error: ${statusText}`;
          }
        }

        this.showMessage(msgText);

      },

      /**
       * Handle the completion of the fetch request
       * @since 0.0.0
       */
      handleFetchComplete() {

        const { qualityReport } = this;
        this.removeListeners();

        if (qualityReport.runStatus !== "success") {
          this.handleFetchError();
          return;
        }
        this.renderResults();
      },

      /**
       * Render the results of the quality report once it has been successfully
       * fetched
       * @since 0.0.0
       */
      renderResults() {

        this.hideLoading();
        const { qualityReport } = this;

        // Filter out the checks with level 'METADATA', as these checks are
        // intended to pass info to metadig-engine indexing (for search,
        // faceting), and not intended for display.
        qualityReport.reset(
          _.reject(qualityReport.models, (model) => {
            const check = model.get("check");
            if (check.level === "METADATA") {
              return true;
            }
            return false;
          }),
        );

        const groupedResults = qualityReport.groupResults(
          qualityReport.models,
        );
        const groupedByType = qualityReport.groupByType(qualityReport.models);

        const data = {
          objectIdentifier: qualityReport.id,
          suiteId: this.suiteId,
          suiteIdList: this.suiteIdList,
          suiteLabels: this.suiteLabels,
          groupedResults,
          groupedByType,
          timestamp: _.now(),
          id: this.pid,
          checkCount: qualityReport.length,
        };

        this.$el.html(this.template(data));
        this.insertBreadcrumbs();
        this.drawScoreChart(qualityReport.models, groupedResults);
        this.showCitation();
        this.show();
        this.$(".popover-this").popover();
      },

      /**
       * Updates the message in the loading image
       * @param {string} message The new message to display
       * @param {boolean} [showHelp] If set to true, and an email contact is configured
       * in MetacatUI, then the contact email will be shown at the bottom of the message.
       * @param {boolean} [showLink] If set to true, a link back to the dataset will be
       * appended to the end of the message.
       * @since 2.15.0
       */
      showMessage(message, showHelp = true, showLink = true) {
        try {
          const view = this;
          const messageEl = this.loadingEl.find(".message");

          if (!messageEl) {
            return;
          }

          // Update the message
          messageEl.html(message);

          // Create a link back to the data set
          if (showLink) {
            const viewURL = `/view/${encodeURIComponent(this.pid)}`;
            const backLink = $(document.createElement("a")).text(
              " Return to the dataset",
            );
            backLink.on("click", () => {
              view.hideLoading();
              MetacatUI.uiRouter.navigate(viewURL, {
                trigger: true,
                replace: true,
              });
            });
            messageEl.append(backLink);
          }

          // Show how the user can get more help
          if (showHelp) {
            const emailAddress = MetacatUI.appModel.get("emailContact");
            // Don't show help if there's no contact email configured
            if (emailAddress) {
              const helpEl = $(
                "<p class='webmaster-email' style='margin-top:20px'>" +
                "<i class='icon-envelope-alt icon icon-on-left'></i>" +
                "Need help? Email us at </p>",
              );
              const emailLink = $(document.createElement("a"))
                .attr("href", `mailto:${emailAddress}`)
                .text(emailAddress);
              helpEl.append(emailLink);
              messageEl.append(helpEl);
            }
          }
        } catch {
          // If there was an error rendering the message, just show the message
          // without any additional content
          document.querySelector(".message").innerHTML = message;
        }
      },

      /**
       * Render a loading image with message
       */
      showLoading() {
        try {
          const loadingEl = this.loadingTemplate({
            message: "Retrieving assessment report...",
            character: "none",
            type: "barchart",
          });
          this.loadingEl = $(loadingEl);
          this.$el.find(this.loadingContainer).html(this.loadingEl);
        } catch (error) {
          // If there was an error rendering the loading image, just show the
          // message
          this.showMessage("Retrieving assessment report...");
        }
      },

      /**
       * Remove the loading image and message.
       */
      hideLoading() {
        this.loadingEl.remove();
      },

      /**
       * Fetch the citation for the dataset and display it
       */
      showCitation() {
        const solrResultModel = new SolrResult({
          id: this.pid,
        });

        this.listenTo(solrResultModel, "sync", () => {
          const citationView = new CitationView({
            model: solrResultModel,
            createLink: false,
            createTitleLink: true,
          });

          citationView.render();

          this.$("#mdqCitation").prepend(citationView.el);
        });
        solrResultModel.getInfo();
      },

      /**
       * Show the view
       */
      show() {
        this.$el.hide();
        this.$el.fadeIn({ duration: "slow" });
      },

      /**
       * Draw a donut chart showing the distribution of results
       * @param {QualityReport[]} results The list of quality checks
       * @param {object} groupedResults An object containing the results grouped by
       * status
       * @param {object} groupedResults.GREEN The list of checks that passed
       * @param {object} groupedResults.ORANGE The list of checks that passed with warnings
       * @param {object} groupedResults.RED The list of checks that failed
       * @param {object} groupedResults.BLUE The list of checks that passed with info
       */
      drawScoreChart(results, groupedResults) {
        const dataCount = results.length;
        const data = [
          {
            label: "Pass",
            count: groupedResults.GREEN.length,
            perc: groupedResults.GREEN.length / results.length,
          },
          {
            label: "Warn",
            count: groupedResults.ORANGE.length,
            perc: groupedResults.ORANGE.length / results.length,
          },
          {
            label: "Fail",
            count: groupedResults.RED.length,
            perc: groupedResults.RED.length / results.length,
          },
          {
            label: "Info",
            count: groupedResults.BLUE.length,
            perc: groupedResults.BLUE.length / results.length,
          },
        ];

        const svgClass = "data";

        // If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
        if (!d3) {
          this.$(".format-charts-data").html(
            `<h2 class='${svgClass
            } fallback'>${MetacatUI.appView.commaSeparateNumber(dataCount)
            } data files</h2>`,
          );

          return;
        }

        // Draw a donut chart
        const donut = new DonutChart({
          id: "data-chart",
          data,
          total: dataCount,
          titleText: "checks",
          titleCount: dataCount,
          svgClass,
          countClass: "data",
          height: 250,
          width: 250,
          keepOrder: true,
          formatLabel(name) {
            return name;
          },
        });
        this.$(".format-charts-data").html(donut.render().el);
      },

      /**
       * Insert breadcrumbs leading back to the dataset and search
       * @since 0.0.0
       */
      insertBreadcrumbs() {
        const breadcrumbs = $(document.createElement("ol"))
          .addClass("breadcrumb")
          .append(
            $(document.createElement("li"))
              .addClass("home")
              .append(
                $(document.createElement("a"))
                  .attr("href", MetacatUI.root ? MetacatUI.root : "/")
                  .addClass("home")
                  .text("Home"),  
              ),
          )
          .append(
            $(document.createElement("li"))
              .addClass("search")
              .append(
                $(document.createElement("a"))
                  .attr(
                    "href",
                    `${MetacatUI.root
                    }/data${MetacatUI.appModel.get("page") > 0
                      ? `/page/${parseInt(MetacatUI.appModel.get("page"), 10) + 1}`
                      : ""}`,
                  )
                  .addClass("search")
                  .text("Search"),
              ),
          )
          .append(
            $(document.createElement("li")).append(
              $(document.createElement("a"))
                .attr(
                  "href",
                  `${MetacatUI.root}/view/${encodeURIComponent(this.pid)}`,
                )
                .addClass("inactive")
                .text("Metadata"),
            ),
          )
          .append(
            $(document.createElement("li")).append(
              $(document.createElement("a"))
                .attr(
                  "href",
                  `${MetacatUI.root}/quality/${encodeURIComponent(this.pid)}`,
                )
                .addClass("inactive")
                .text("Assessment Report"),
            ),
          );

        this.$(this.breadcrumbContainer).html(breadcrumbs);
      },
    },
  );
  return MdqRunView;
});
