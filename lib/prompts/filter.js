/**
 * `list` type prompt
 */

var _ = require("lodash");
var util = require("util");
var chalk = require("chalk");
var figures = require("figures");
var Base = require("./base");
var observe = require("../utils/events");
var utils = require("../utils/readline");
var Paginator = require("../utils/paginator");


/**
 * Module exports
 */

module.exports = Prompt;


/**
 * Constructor
 */

function Prompt() {
  Base.apply( this, arguments );

  if (!this.opt.choices) {
    this.throwParamError("choices");
  }

  this.firstRender = true;
  this.selected = 0;
  this.searchMode = false;

  this.keyword = "";
  this.invalidSelection = false;

  var def = this.opt.default;

  // Default being a Number
  if ( _.isNumber(def) && def >= 0 && def < this.opt.choices.realLength ) {
    this.selected = def;
  }

  // Default being a String
  if ( _.isString(def) ) {
    this.selected = this.opt.choices.pluck("value").indexOf( def );
  }

  // Make sure no default is set (so it won't be printed)
  this.opt.default = null;

  this.paginator = new Paginator();
}
util.inherits( Prompt, Base );


/**
 * Start the Inquiry session
 * @param  {Function} cb      Callback when prompt is done
 * @return {this}
 */

Prompt.prototype._run = function( cb ) {
  this.done = cb;

  var events = observe(this.rl);
  events.normalizedUpKey.takeUntil( events.line ).forEach( this.onUpKey.bind(this) );
  events.normalizedDownKey.takeUntil( events.line ).forEach( this.onDownKey.bind(this) );
  events.numberKey.takeUntil( events.line ).forEach( this.onNumberKey.bind(this) );
  events.normalizedSearch.take(1).forEach( this.onSearchKey.bind(this) );
  events.keypress.takeUntil( events.line ).forEach( this.onPressKey.bind(this) );
  events.line.take(1).forEach( this.onSubmit.bind(this) );

  // Init the prompt
  utils.hideCursor(this.rl);
  this.render();

  return this;
};


/**
 * Render the prompt to screen
 * @return {Prompt} self
 */

Prompt.prototype.render = function() {
  // Render question
  var message = this.getQuestion();
  var choicesStr;
  var completeChoices;
  var keyword = this.keyword;
  if(this.searchMode){
      var filter = function(choice){
        return choice.value.indexOf(keyword) != -1;
      }
      
      completeChoices = this.opt.choices.choices;
      this.opt.choices.choices = this.opt.choices.filter(filter);

      var id;
      if(this.opt.choices.choices != null && this.opt.choices.choices.length > 0){
        id = this.opt.choices.choices[0].value;
      } 

      var position;
      for(var i = 0; i < completeChoices.length; i++){
        if(completeChoices[i].value == id){
          position = i;
          break;
        }
      }
      this.selected = position;
      
      if(this.selected != undefined){
        choicesStr = listRender(this.opt.choices, this.selected );
        this.invalidSelection = false;
      } else{
        choicesStr = "\n" + "NO ENTRY MATCHING";
        this.invalidSelection = true;
      }
      
      this.opt.choices.choices = completeChoices;

      message += chalk.dim( "(Searching: " + this.keyword + " )");
  }

  if ( this.firstRender ) {
    message += chalk.dim( "(Use arrow keys, / to search)" );
  }

  // Render choices or answer depending on the state
  if ( this.status === "answered" ) {
    message += "\n" + chalk.cyan( this.opt.choices.getChoice(this.selected).name );
  } else {
    var choicesStr = listRender(this.opt.choices, this.selected );
    message += "\n" + this.paginator.paginate(choicesStr, this.selected);
  }



  this.firstRender = false;

  this.screen.render(message);
};


/**
 * When user press `enter` key
 */

Prompt.prototype.onSubmit = function() {
  if(!this.invalidSelection){
    var choice = this.opt.choices.getChoice( this.selected );
    this.status = "answered";
    this.searchMode = false;

    // Rerender prompt
    this.render();

    this.screen.done();
    utils.showCursor(this.rl);
    this.done( choice.value );
  }else{
    process.exit();
  }
};


/**
 * When user press a key
 */
Prompt.prototype.onUpKey = function(input) {
  if(!this.searchMode || (this.searchMode && input.value != "k")){
    var len = this.opt.choices.realLength;
    this.selected = (this.selected > 0) ? this.selected - 1 : len - 1;
    this.render();
  }
};

Prompt.prototype.onDownKey = function(input) {
  if(!this.searchMode || (this.searchMode && input.value != "j")){
    var len = this.opt.choices.realLength;
    this.selected = (this.selected < len - 1) ? this.selected + 1 : 0;
    this.render();
  }
};

Prompt.prototype.onNumberKey = function( input ) {
  if ( input <= this.opt.choices.realLength ) {
    this.selected = input - 1;
  }
  this.render();
};

Prompt.prototype.onSearchKey = function( input ) {
  this.searchMode = true;
  this.render();
};

Prompt.prototype.onPressKey = function( input ) {
  this.screen.render(JSON.stringify(input, null, "  ") );
  if(this.searchMode){
    if(input.value && input.value.charCodeAt(0) === 127){
      this.keyword = this.keyword.substring(0, this.keyword.length -1);
    }else{
      if(this.keyword.length === 0 && input.value == "/"){
        }
      else{
        this.keyword += input.value;
      }
    }
  }
  this.render();
};


/**
 * Function for rendering list choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */
 function listRender(choices, pointer) {
  var output = '';
  var separatorOffset = 0;

  choices.forEach(function (choice, i) {
    if (choice.type === 'separator') {
      separatorOffset++;
      output += '  ' + choice + '\n';
      return;
    }

    var isSelected = (i - separatorOffset === pointer);
    var line = (isSelected ? figures.pointer + ' ' : '  ') + choice.name;
    if (isSelected) {
      line = chalk.cyan(line);
    }
    output += line + ' \n';
  });

  return output.replace(/\n$/, '');
}
