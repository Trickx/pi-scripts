#engine v8
/*
   FilterZWOFit.js
   PixInsight 1.9.4 (PJSR) Feature Script:
   GUI tool to write the FILTER keyword in the FITS header,
   with single-image and batch processing modes.
*/
// Engine hint: prefer the PJSR engine on builds without legacy 'sm'.
#feature-id    Utilities > FilterZWOFit
#feature-info  Sets the FILTER value in the FITS header of the active image or in batch mode for a selected folder.
#feature-icon  FilterZWOFit.svg

#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/DataType.jsh>

var DEFAULT_FILTER_FILE_NAME = "filter.txt";
var DEBUG_ENABLED = true;
var SUPPORTED_IMAGE_EXTENSIONS = [ ".fit", ".fits", ".fts", ".xisf" ];
var SETTINGS_PREFIX = "FilterZWOFit";
var SETTINGS_KEY_LAST_BATCH_DIR = SETTINGS_PREFIX + "/LastBatchDirectory";
var SETTINGS_KEY_LAST_FILTER = SETTINGS_PREFIX + "/LastFilter";
var SETTINGS_KEY_FILTER_TEXT = SETTINGS_PREFIX + "/FilterText";

function logDebug( msg )
{
   if ( !DEBUG_ENABLED )
      return;
   console.show();
   console.noteln( "[FilterZWOFit][DEBUG] " + msg );
}

function logWarn( msg )
{
   console.show();
   console.warningln( "[FilterZWOFit][WARN] " + msg );
}

function logError( msg )
{
   console.show();
   console.criticalln( "[FilterZWOFit][ERROR] " + msg );
}

function readSettingString( key, defaultValue )
{
   try
   {
      var v = Settings.read( key, DataType_String );
      if ( v == null )
         return defaultValue;
      var s = String( v );
      return s.length > 0 ? s : defaultValue;
   }
   catch ( ex )
   {
         logWarn( "Settings.read failed for " + key + ": " + ex );
      return defaultValue;
   }
}

function writeSettingString( key, value )
{
   try
   {
      Settings.write( key, DataType_String, value );
      logDebug( "Setting stored: " + key + " = " + value );
   }
   catch ( ex )
   {
      logWarn( "Settings.write failed for " + key + ": " + ex );
   }
}

function findFilterIndex( filters, filterValue )
{
   var target = trimText( filterValue ).toUpperCase();
   if ( target.length == 0 )
      return -1;

   var i;
   for ( i = 0; i < filters.length; ++i )
      if ( trimText( filters[i] ).toUpperCase() == target )
         return i;

   return -1;
}

function trimText( s )
{
   return s.replace( /^\s+|\s+$/g, "" );
}

function fitsStringValue( s )
{
   // FITS string values must be enclosed in single quotes.
   // Single quotes in content are escaped by doubling them.
   return "'" + s.replace( /'/g, "''" ) + "'";
}

function normalizeFilterToken( s )
{
   return trimText( s );
}

function parseFilterLine( line, outFilters, seen )
{
   var clean = trimText( line );
   if ( clean.length == 0 )
      return;
   if ( clean.charAt( 0 ) == "#" )
      return;

   var parts = clean.split( /[,;]+/ );
   var i;
   for ( i = 0; i < parts.length; ++i )
   {
      var token = normalizeFilterToken( parts[i] );
      if ( token.length == 0 )
         continue;

      var key = token.toUpperCase();
      if ( seen[key] )
         continue;

      seen[key] = true;
      outFilters.push( token );
   }
}

function loadFiltersFromFile( filePath )
{
   logDebug( "Loading filter file: " + filePath );
   var text = File.readTextFile( filePath );
   return loadFiltersFromText( text, filePath );
}

function loadFiltersFromText( text, sourceLabel )
{
   var lines = text.split( /\r\n|\n|\r/ );
   var filters = [];
   var seen = {};
   var i;
   for ( i = 0; i < lines.length; ++i )
      parseFilterLine( lines[i], filters, seen );

   logDebug( "Filter list read from " + sourceLabel + ". Lines: " + lines.length + ", valid filters: " + filters.length );

   return filters;
}

function defaultFilterFileTemplate()
{
   return "# Filter list for FilterZWOFit\n" +
          "L\nR\nG\nB\nHa\nOIII\nSII\n";
}

function stripOuterQuotes( s )
{
   var t = trimText( s );
   if ( t.length >= 2 )
   {
      var a = t.charAt( 0 );
      var b = t.charAt( t.length-1 );
      if ( (a == '"' && b == '"') || (a == "'" && b == "'") )
         return t.substring( 1, t.length-1 );
   }
   return t;
}

function directoryFromPath( path )
{
   var p = stripOuterQuotes( path ).replace( /\\/g, "/" );
   var i = p.lastIndexOf( "/" );
   if ( i <= 0 )
      return "";
   return p.substring( 0, i );
}

function getDefaultFilterFilePath()
{
   // Documented PJSR pattern: #__FILE__ provides current script path as a string literal.
   var scriptPath = #__FILE__;
   var scriptDir = File.extractDirectory( scriptPath );
   logDebug( "__FILE__ = " + scriptPath );
   logDebug( "Script directory = " + scriptDir );
   if ( scriptDir.length > 0 )
      return scriptDir + "/" + DEFAULT_FILTER_FILE_NAME;

   var baseDir = File.currentWorkingDirectory;
   logWarn( "Could not resolve script directory from arguments. Fallback to CWD: " + baseDir );
   if ( baseDir.length == 0 )
      return DEFAULT_FILTER_FILE_NAME;

   if ( baseDir.charAt( baseDir.length-1 ) == '/' )
      return baseDir + DEFAULT_FILTER_FILE_NAME;

   return baseDir + "/" + DEFAULT_FILTER_FILE_NAME;
}

function endsWith( s, suffix )
{
   return s.length >= suffix.length && s.substr( s.length - suffix.length ) == suffix;
}

function isSupportedImageFile( filePath )
{
   var lower = filePath.toLowerCase();
   var i;
   for ( i = 0; i < SUPPORTED_IMAGE_EXTENSIONS.length; ++i )
      if ( endsWith( lower, SUPPORTED_IMAGE_EXTENSIONS[i] ) )
         return true;
   return false;
}

function listBatchFiles( directory )
{
   var files = [];
   var pattern = directory;
   if ( pattern.charAt( pattern.length-1 ) != '/' )
      pattern += "/";
   pattern += "*";

   var f = new FileFind;
   if ( f.begin( pattern ) )
   {
      do
      {
         if ( f.isDirectory )
            continue;

         var filePath = directory;
         if ( filePath.charAt( filePath.length-1 ) != '/' )
            filePath += "/";
         filePath += f.name;

         if ( isSupportedImageFile( filePath ) )
            files.push( filePath );
      }
      while ( f.next() );
   }

   return files;
}

function processBatchDirectory( directory, filterText )
{
   var files = listBatchFiles( directory );
   logDebug( "Batch files found: " + files.length );

   var result = {
      total: files.length,
      success: 0,
      failed: 0
   };

   var i;
   for ( i = 0; i < files.length; ++i )
   {
      var filePath = files[i];
      logDebug( "Batch processing: " + filePath );

      var windows = null;
      try
      {
         windows = ImageWindow.open( filePath );
         if ( windows == null || windows.length < 1 )
            throw "File could not be opened.";

         var w = windows[0];
         var action = upsertFilterKeyword( w, filterText );
         if ( !w.saveAs( filePath, false, false, false, false ) )
            throw "File could not be saved.";

         logDebug( "Batch OK (" + action + "): " + filePath );
         ++result.success;
      }
      catch ( ex )
      {
         logError( "Batch error on " + filePath + ": " + ex );
         ++result.failed;
      }
      finally
      {
         if ( windows != null )
         {
            var k;
            for ( k = 0; k < windows.length; ++k )
               if ( !windows[k].isNull )
                  windows[k].forceClose();
         }
      }
   }

   return result;
}

function upsertFilterKeyword( window, filterText )
{
   var keywords = window.keywords;
   var value = fitsStringValue( filterText );
   var i;

   logDebug( "Setting FILTER to: " + filterText );

   for ( i = 0; i < keywords.length; ++i )
      if ( keywords[i].name.toUpperCase() == "FILTER" )
      {
         keywords[i] = new FITSKeyword( "FILTER", value, "Optical filter" );
         window.keywords = keywords;
         logDebug( "FILTER keyword updated." );
         return "updated";
      }

   keywords.push( new FITSKeyword( "FILTER", value, "Optical filter" ) );
   window.keywords = keywords;
   logDebug( "FILTER keyword created." );
   return "created";
}

class FilterFileEditorDialog extends Dialog {
   constructor( filePath, initialText ) {
      super();

      this.windowTitle = "FilterZWOFit - Edit filter file";
      this.filePath = filePath;
      this.editedText = initialText;

      this.pathLabel = new Label( this );
      this.pathLabel.useRichText = true;
      this.pathLabel.wordWrapping = true;
      this.pathLabel.text = "File: " + filePath;

      this.editor = new TextBox( this );
      this.editor.text = initialText;
      this.editor.minWidth = this.font.width( "X" ) * 60;
      this.editor.minHeight = this.font.height * 16;

      this.saveButton = new PushButton( this );
      this.saveButton.text = "Save";
      this.saveButton.defaultButton = true;
      this.saveButton.onClick = function()
      {
         this.dialog.editedText = this.dialog.editor.text;
         this.dialog.ok();
      };

      this.cancelButton = new PushButton( this );
      this.cancelButton.text = "Cancel";
      this.cancelButton.onClick = function()
      {
         this.dialog.cancel();
      };

      this.buttonSizer = new HorizontalSizer;
      this.buttonSizer.spacing = 8;
      this.buttonSizer.addStretch();
      this.buttonSizer.add( this.saveButton );
      this.buttonSizer.add( this.cancelButton );

      this.sizer = new VerticalSizer;
      this.sizer.margin = 10;
      this.sizer.spacing = 8;
      this.sizer.add( this.pathLabel );
      this.sizer.add( this.editor, 100 );
      this.sizer.add( this.buttonSizer );

      this.adjustToContents();
   }
}

class FilterDialog extends Dialog {
   constructor() {
      super();

      this.windowTitle = "FilterZWOFit - Set FILTER in FITS Header";
      this.filterText = "";
      this.filterFilePath = "";
      this.filters = [];
      this.runMode = "single";
      this.batchDirectory = "";
      this.lastBatchDirectory = readSettingString( SETTINGS_KEY_LAST_BATCH_DIR, File.currentWorkingDirectory );
      this.lastFilterValue = readSettingString( SETTINGS_KEY_LAST_FILTER, "" );

      this.helpLabel = new Label( this );
      this.helpLabel.useRichText = true;
      this.helpLabel.wordWrapping = true;
      var tooltipFromList = "Filter List: Select a filter loaded from your saved filter list.";
      var tooltipManual = "Filter String: Enter or edit the FILTER value that will be written to FITS headers.";
      var tooltipApply = "Apply: Write FILTER to the active image.";
      var tooltipBatch = "Batch...: Process all supported files in a selected folder.";
      var tooltipEdit = "Edit...: Open the filter-list editor.";
      var tooltipCancel = "Cancel: Close this dialog without changes.";
      this.helpLabel.text =
         "This script writes the selected filter value to the FILTER keyword in the FITS header.";

      var labelWidth = this.font.width( "Filter String:" ) + 8;
      var valueWidth = this.font.width( "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" );

      this.editFilterFileButton = new PushButton( this );
      this.editFilterFileButton.text = "Edit...";
      this.editFilterFileButton.toolTip = tooltipEdit;
      this.editFilterFileButton.onClick = function()
      {
         var filePath = trimText( this.dialog.filterFilePath );
         if ( filePath.length == 0 )
            filePath = getDefaultFilterFilePath();

         var text = "";
         var storedText = readSettingString( SETTINGS_KEY_FILTER_TEXT, "" );
         try
         {
            if ( storedText.length > 0 )
               text = storedText;
            else
               text = File.exists( filePath ) ? File.readTextFile( filePath ) : defaultFilterFileTemplate();
         }
         catch ( ex )
         {
            logError( "Could not read filter file: " + ex );
            (new MessageBox(
               "Error while reading filter file:\n" + ex,
               "FilterZWOFit",
               StdIcon_Error,
               StdButton_Ok
            )).execute();
            return;
         }

         var editorDlg = new FilterFileEditorDialog( filePath, text );
         if ( !editorDlg.execute() )
            return;

         try
         {
            writeSettingString( SETTINGS_KEY_FILTER_TEXT, editorDlg.editedText );
            logDebug( "Filter list saved in user settings." );

            try
            {
               File.writeTextFile( filePath, editorDlg.editedText );
               logDebug( "Filter file saved: " + filePath );
            }
            catch ( writeEx )
            {
               logWarn( "Could not write filter file path (read-only install is fine): " + writeEx );
            }

            this.dialog.loadFilterFile( filePath );
         }
         catch ( ex2 )
         {
            logError( "Could not save filter file: " + ex2 );
            (new MessageBox(
               "Error while saving filter file:\n" + ex2,
               "FilterZWOFit",
               StdIcon_Error,
               StdButton_Ok
            )).execute();
         }
      };

      this.selectLabel = new Label( this );
      this.selectLabel.text = "Filter List:";
      this.selectLabel.minWidth = labelWidth;
      this.selectLabel.toolTip = tooltipFromList;

      this.filterCombo = new ComboBox( this );
      this.filterCombo.editEnabled = false;
      this.filterCombo.minWidth = valueWidth;
      this.filterCombo.toolTip = tooltipFromList;
      this.filterCombo.onItemSelected = function( index )
      {
         if ( index < 0 )
            return;
         this.dialog.filterEdit.text = this.itemText( index );
      };

      this.selectSizer = new HorizontalSizer;
      this.selectSizer.spacing = 6;
      this.selectSizer.add( this.selectLabel );
      this.selectSizer.add( this.filterCombo, 100 );

      this.filterLabel = new Label( this );
      this.filterLabel.text = "Filter String:";
      this.filterLabel.minWidth = labelWidth;
      this.filterLabel.toolTip = tooltipManual;

      this.filterEdit = new Edit( this );
      this.filterEdit.minWidth = this.font.width( "XXXXXXXXXXXX" ) * 2;
      this.filterEdit.toolTip = tooltipManual;
      if ( this.lastFilterValue.length > 0 )
         this.filterEdit.text = this.lastFilterValue;

      this.inputSizer = new HorizontalSizer;
      this.inputSizer.spacing = 6;
      this.inputSizer.add( this.filterLabel );
      this.inputSizer.add( this.filterEdit, 100 );

      this.okButton = new PushButton( this );
      this.okButton.text = "Apply";
      this.okButton.toolTip = tooltipApply;
      this.okButton.defaultButton = true;
      this.okButton.onClick = function()
      {
         var t = trimText( this.dialog.filterEdit.text );
         if ( t.length == 0 )
         {
            (new MessageBox(
               "Please enter a non-empty FILTER value.",
               "FilterZWOFit",
               StdIcon_Warning,
               StdButton_Ok
            )).execute();
            return;
         }

         this.dialog.filterText = t;
         writeSettingString( SETTINGS_KEY_LAST_FILTER, t );
         this.dialog.runMode = "single";
         this.dialog.ok();
      };

      this.batchButton = new PushButton( this );
      this.batchButton.text = "Batch...";
      this.batchButton.toolTip = tooltipBatch;
      this.batchButton.onClick = function()
      {
         var t = trimText( this.dialog.filterEdit.text );
         if ( t.length == 0 )
         {
            (new MessageBox(
               "Please enter a non-empty FILTER value.",
               "FilterZWOFit",
               StdIcon_Warning,
               StdButton_Ok
            )).execute();
            return;
         }

         var gdd = new GetDirectoryDialog;
         gdd.caption = "Choose batch folder";
         gdd.initialPath = this.dialog.lastBatchDirectory;
         if ( !gdd.execute() )
         {
            logDebug( "Batch selection canceled." );
            return;
         }

         this.dialog.filterText = t;
         this.dialog.batchDirectory = gdd.directory;
         this.dialog.lastBatchDirectory = gdd.directory;
         writeSettingString( SETTINGS_KEY_LAST_BATCH_DIR, gdd.directory );
         writeSettingString( SETTINGS_KEY_LAST_FILTER, t );
         this.dialog.runMode = "batch";
         this.dialog.ok();
      };

      this.cancelButton = new PushButton( this );
      this.cancelButton.text = "Cancel";
      this.cancelButton.toolTip = tooltipCancel;
      this.cancelButton.onClick = function()
      {
         this.dialog.cancel();
      };

      this.buttonSizer = new HorizontalSizer;
      this.buttonSizer.spacing = 8;
      this.buttonSizer.addStretch();
      this.buttonSizer.add( this.okButton );
      this.buttonSizer.add( this.batchButton );
      this.buttonSizer.add( this.cancelButton );
      this.buttonSizer.add( this.editFilterFileButton );

      this.sizer = new VerticalSizer;
      this.sizer.margin = 10;
      this.sizer.spacing = 8;
      this.sizer.add( this.helpLabel );
      this.sizer.add( this.selectSizer );
      this.sizer.add( this.inputSizer );
      this.sizer.addSpacing( 4 );
      this.sizer.add( this.buttonSizer );

      this.adjustToContents();
      this.setFixedSize();

      this.loadFilterFile( getDefaultFilterFilePath() );
   }
}

FilterDialog.prototype.populateFilterCombo = function( filters )
{
   this.filterCombo.clear();

   var i;
   for ( i = 0; i < filters.length; ++i )
      this.filterCombo.addItem( filters[i] );

   if ( filters.length > 0 )
      this.filterCombo.currentItem = 0;
};

FilterDialog.prototype.loadFilterFile = function( filePath )
{
   logDebug( "loadFilterFile called with: " + filePath );

   var storedText = readSettingString( SETTINGS_KEY_FILTER_TEXT, "" );
   if ( storedText.length > 0 )
   {
      try
      {
         var stored = loadFiltersFromText( storedText, "user settings" );
         this.filters = stored;
         this.filterFilePath = filePath;
         this.populateFilterCombo( stored );

         if ( stored.length > 0 )
         {
            var sidx = findFilterIndex( stored, this.lastFilterValue );
            if ( sidx >= 0 )
            {
               this.filterCombo.currentItem = sidx;
               this.filterEdit.text = stored[sidx];
            }
            else if ( trimText( this.filterEdit.text ).length == 0 )
            {
               this.filterCombo.currentItem = 0;
               this.filterEdit.text = stored[0];
            }
            logDebug( "Filter list loaded from user settings: " + stored.length + " entries" );
         }
         else
         {
            this.filterEdit.text = "";
            logWarn( "Stored filter list exists but has no valid entries." );
         }

         return;
      }
      catch ( storedEx )
      {
         logWarn( "Could not load filter list from user settings: " + storedEx );
      }
   }

   if ( !File.exists( filePath ) )
   {
      this.filters = [];
      this.filterFilePath = filePath;
      this.populateFilterCombo( [] );
      logWarn( "Filter file not found: " + filePath );

      (new MessageBox(
         "Filter file not found:\n" + filePath + "\n\n" +
         "You can still enter the FILTER value manually.",
         "FilterZWOFit",
         StdIcon_Warning,
         StdButton_Ok
      )).execute();
      return;
   }

   try
   {
      var loaded = loadFiltersFromFile( filePath );
      this.filters = loaded;
      this.filterFilePath = filePath;
      this.populateFilterCombo( loaded );

      if ( loaded.length > 0 )
      {
         var idx = findFilterIndex( loaded, this.lastFilterValue );
         if ( idx >= 0 )
         {
            this.filterCombo.currentItem = idx;
            this.filterEdit.text = loaded[idx];
         }
         else if ( trimText( this.filterEdit.text ).length == 0 )
         {
            this.filterCombo.currentItem = 0;
            this.filterEdit.text = loaded[0];
         }
         logDebug( "Filter list loaded: " + loaded.length + " entries" );
      }
      else
      {
         this.filterEdit.text = "";
         logWarn( "Filter file read, but no valid entries were found." );
         (new MessageBox(
            "File loaded, but no valid filter entries were found.",
            "FilterZWOFit",
            StdIcon_Warning,
            StdButton_Ok
         )).execute();
      }
   }
   catch ( ex )
   {
      logError( "Error while loading filter file: " + ex );
      (new MessageBox(
         "Error while loading filter file:\n" + ex,
         "FilterZWOFit",
         StdIcon_Error,
         StdButton_Ok
      )).execute();
   }
};

function main()
{
   logDebug( "Script started" );
   logDebug( "Saved last batch folder key: " + SETTINGS_KEY_LAST_BATCH_DIR );
   logDebug( "Saved last filter key: " + SETTINGS_KEY_LAST_FILTER );

   var dlg = new FilterDialog;
   if ( !dlg.execute() )
   {
      logDebug( "Dialog canceled." );
      return;
   }

   if ( dlg.runMode == "batch" )
   {
      var batchDir = trimText( dlg.batchDirectory );
      if ( batchDir.length == 0 )
      {
         logError( "Batch mode without target directory." );
         return;
      }

      var r = processBatchDirectory( batchDir, dlg.filterText );
      var summary =
         "Batch completed.\n" +
         "Folder: " + batchDir + "\n" +
         "Total files: " + r.total + "\n" +
         "Successful: " + r.success + "\n" +
         "Errors: " + r.failed;

      console.show();
      console.noteln( "[FilterZWOFit] " + summary.replace( /\n/g, " | " ) );

      (new MessageBox(
         summary,
         "FilterZWOFit",
         (r.failed > 0) ? StdIcon_Warning : StdIcon_Information,
         StdButton_Ok
      )).execute();

      return;
   }

   var w = ImageWindow.activeWindow;
   if ( w.isNull )
   {
      logError( "No active image window available for single mode." );
      (new MessageBox(
         "No active image window found.\nPlease open an image first or use batch mode.",
         "FilterZWOFit",
         StdIcon_Error,
         StdButton_Ok
      )).execute();
      return;
   }

   var action = upsertFilterKeyword( w, dlg.filterText );

   console.show();
   console.noteln( "FILTER " + action + ": " + dlg.filterText );

   (new MessageBox(
      "FILTER " + action + ": " + dlg.filterText,
      "FilterZWOFit",
      StdIcon_Information,
      StdButton_Ok
   )).execute();
}

main();
