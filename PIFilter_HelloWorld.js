/*
   PIFilter_HelloWorld.js
   PixInsight 1.9.4 (PJSR) Beispiel:
   GUI zum Setzen des FILTER-Schluesselworts im FITS-Header
   des aktuell geoeffneten Bildfensters.
*/

#feature-id    Utilities > PIFilter > SetFilterKeyword
#feature-info  Setzt per GUI den FILTER-Wert im FITS-Header des aktiven Bildfensters.

#include <pjsr/Sizer.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/DataType.jsh>

var DEFAULT_FILTER_FILE_NAME = "filter.txt";
var DEBUG_ENABLED = true;
var SUPPORTED_IMAGE_EXTENSIONS = [ ".fit", ".fits", ".fts", ".xisf" ];
var SETTINGS_PREFIX = "PIFilter";
var SETTINGS_KEY_LAST_BATCH_DIR = SETTINGS_PREFIX + "/LastBatchDirectory";
var SETTINGS_KEY_LAST_FILTER = SETTINGS_PREFIX + "/LastFilter";

function logDebug( msg )
{
   if ( !DEBUG_ENABLED )
      return;
   console.show();
   console.noteln( "[PIFilter][DEBUG] " + msg );
}

function logWarn( msg )
{
   console.show();
   console.warningln( "[PIFilter][WARN] " + msg );
}

function logError( msg )
{
   console.show();
   console.criticalln( "[PIFilter][ERROR] " + msg );
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
      logWarn( "Settings.read fehlgeschlagen fuer " + key + ": " + ex );
      return defaultValue;
   }
}

function writeSettingString( key, value )
{
   try
   {
      Settings.write( key, DataType_String, value );
      logDebug( "Setting gespeichert: " + key + " = " + value );
   }
   catch ( ex )
   {
      logWarn( "Settings.write fehlgeschlagen fuer " + key + ": " + ex );
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
   // FITS-Stringwerte muessen in einfachen Anfuehrungszeichen stehen.
   // Einzelne Anfuehrungszeichen im Inhalt werden verdoppelt.
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
   logDebug( "Lade Filterdatei: " + filePath );
   var text = File.readTextFile( filePath );
   var lines = text.split( /\r\n|\n|\r/ );
   var filters = [];
   var seen = {};
   var i;
   for ( i = 0; i < lines.length; ++i )
      parseFilterLine( lines[i], filters, seen );

    logDebug( "Filterdatei gelesen. Zeilen: " + lines.length + ", gueltige Filter: " + filters.length );

   return filters;
}

function defaultFilterFileTemplate()
{
   return "# Filterliste fuer PIFilter\n" +
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
   // Dokumentiertes PJSR-Muster: #__FILE__ liefert den aktuellen Skriptpfad als Stringliteral.
   var scriptPath = #__FILE__;
   var scriptDir = File.extractDirectory( scriptPath );
   logDebug( "__FILE__ = " + scriptPath );
   logDebug( "Skriptverzeichnis = " + scriptDir );
   if ( scriptDir.length > 0 )
      return scriptDir + "/" + DEFAULT_FILTER_FILE_NAME;

   var baseDir = File.currentWorkingDirectory;
   logWarn( "Konnte kein Skriptverzeichnis aus Argumenten ermitteln. Fallback auf CWD: " + baseDir );
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
         if ( f.name.length > 0 && f.name.charAt( 0 ) == '.' )
            continue;

         var filePath = directory + "/" + f.name;
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
   logDebug( "Batch-Dateien gefunden: " + files.length );

   var result = {
      total: files.length,
      success: 0,
      failed: 0
   };

   var i;
   for ( i = 0; i < files.length; ++i )
   {
      var filePath = files[i];
      logDebug( "Batch bearbeite: " + filePath );

      var windows = null;
      try
      {
         windows = ImageWindow.open( filePath );
         if ( windows == null || windows.length == 0 )
            throw "Datei konnte nicht geoeffnet werden.";

         var w = windows[0];
         var action = upsertFilterKeyword( w, filterText );
         if ( !w.saveAs( filePath, false, false, false, false ) )
            throw "Datei konnte nicht gespeichert werden.";

         logDebug( "Batch OK (" + action + "): " + filePath );
         ++result.success;
      }
      catch ( ex )
      {
         logError( "Batch Fehler bei " + filePath + ": " + ex );
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

   logDebug( "Setze FILTER auf: " + filterText );

   for ( i = 0; i < keywords.length; ++i )
      if ( keywords[i].name.toUpperCase() == "FILTER" )
      {
         keywords[i] = new FITSKeyword( "FILTER", value, "Optical filter" );
         window.keywords = keywords;
         logDebug( "FILTER-Keyword aktualisiert." );
         return "aktualisiert";
      }

   keywords.push( new FITSKeyword( "FILTER", value, "Optical filter" ) );
   window.keywords = keywords;
   logDebug( "FILTER-Keyword neu angelegt." );
   return "angelegt";
}

function FilterFileEditorDialog( filePath, initialText )
{
   this.__base__ = Dialog;
   this.__base__();

   this.windowTitle = "PIFilter - Filterdatei bearbeiten";
   this.filePath = filePath;
   this.editedText = initialText;

   this.pathLabel = new Label( this );
   this.pathLabel.useRichText = true;
   this.pathLabel.wordWrapping = true;
   this.pathLabel.text = "Datei: " + filePath;

   this.editor = new TextBox( this );
   this.editor.text = initialText;
   this.editor.minWidth = this.font.width( "X" ) * 60;
   this.editor.minHeight = this.font.height * 16;

   this.saveButton = new PushButton( this );
   this.saveButton.text = "Speichern";
   this.saveButton.defaultButton = true;
   this.saveButton.onClick = function()
   {
      this.dialog.editedText = this.dialog.editor.text;
      this.dialog.ok();
   };

   this.cancelButton = new PushButton( this );
   this.cancelButton.text = "Abbrechen";
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

FilterFileEditorDialog.prototype = new Dialog;

function FilterDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   this.windowTitle = "PIFilter - FILTER im FITS-Header setzen";
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
   this.helpLabel.text =
      "Filterliste wird beim Start automatisch aus filter.txt geladen.\n" +
      "Du kannst den FILTER-Wert auch manuell eingeben oder per Batch anwenden.";

   this.fileLabel = new Label( this );
   this.fileLabel.text = "Filterdatei:";
   this.fileLabel.minWidth = this.font.width( "Filterdatei:" ) + 8;

   this.fileEdit = new Edit( this );
   this.fileEdit.readOnly = true;
   this.fileEdit.minWidth = this.font.width( "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" );

   this.editFilterFileButton = new PushButton( this );
   this.editFilterFileButton.text = "Bearbeiten...";
   this.editFilterFileButton.onClick = function()
   {
      var filePath = trimText( this.dialog.filterFilePath );
      if ( filePath.length == 0 )
         filePath = getDefaultFilterFilePath();

      var text = "";
      try
      {
         text = File.exists( filePath ) ? File.readTextFile( filePath ) : defaultFilterFileTemplate();
      }
      catch ( ex )
      {
         logError( "Filterdatei konnte nicht gelesen werden: " + ex );
         (new MessageBox(
            "Fehler beim Lesen der Filterdatei:\n" + ex,
            "PIFilter",
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
         File.writeTextFile( filePath, editorDlg.editedText );
         logDebug( "Filterdatei gespeichert: " + filePath );
         this.dialog.loadFilterFile( filePath );
      }
      catch ( ex2 )
      {
         logError( "Filterdatei konnte nicht gespeichert werden: " + ex2 );
         (new MessageBox(
            "Fehler beim Speichern der Filterdatei:\n" + ex2,
            "PIFilter",
            StdIcon_Error,
            StdButton_Ok
         )).execute();
      }
   };

   this.fileSizer = new HorizontalSizer;
   this.fileSizer.spacing = 6;
   this.fileSizer.add( this.fileLabel );
   this.fileSizer.add( this.fileEdit, 100 );
   this.fileSizer.add( this.editFilterFileButton );

   this.selectLabel = new Label( this );
   this.selectLabel.text = "Aus Liste:";
   this.selectLabel.minWidth = this.fileLabel.minWidth;

   this.filterCombo = new ComboBox( this );
   this.filterCombo.editEnabled = false;
   this.filterCombo.minWidth = this.fileEdit.minWidth;
   this.filterCombo.toolTip = "Geladene Filter aus Datei";
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
   this.filterLabel.text = "Manuell:";
   this.filterLabel.minWidth = this.fileLabel.minWidth;

   this.filterEdit = new Edit( this );
   this.filterEdit.minWidth = this.font.width( "XXXXXXXXXXXX" ) * 2;
   if ( this.lastFilterValue.length > 0 )
      this.filterEdit.text = this.lastFilterValue;

   this.inputSizer = new HorizontalSizer;
   this.inputSizer.spacing = 6;
   this.inputSizer.add( this.filterLabel );
   this.inputSizer.add( this.filterEdit, 100 );

   this.okButton = new PushButton( this );
   this.okButton.text = "Setzen";
   this.okButton.defaultButton = true;
   this.okButton.onClick = function()
   {
      var t = trimText( this.dialog.filterEdit.text );
      if ( t.length == 0 )
      {
         (new MessageBox(
            "Bitte einen nicht-leeren FILTER-Wert eingeben.",
            "PIFilter",
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
   this.batchButton.text = "Batch";
   this.batchButton.onClick = function()
   {
      var t = trimText( this.dialog.filterEdit.text );
      if ( t.length == 0 )
      {
         (new MessageBox(
            "Bitte einen nicht-leeren FILTER-Wert eingeben.",
            "PIFilter",
            StdIcon_Warning,
            StdButton_Ok
         )).execute();
         return;
      }

      var gdd = new GetDirectoryDialog;
      gdd.caption = "Batch-Ordner waehlen";
      gdd.initialPath = this.dialog.lastBatchDirectory;
      if ( !gdd.execute() )
      {
         logDebug( "Batch-Auswahl abgebrochen." );
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
   this.cancelButton.text = "Abbrechen";
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

   this.sizer = new VerticalSizer;
   this.sizer.margin = 10;
   this.sizer.spacing = 8;
   this.sizer.add( this.helpLabel );
   this.sizer.add( this.fileSizer );
   this.sizer.add( this.selectSizer );
   this.sizer.add( this.inputSizer );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.buttonSizer );

   this.adjustToContents();
   this.setFixedSize();

   this.loadFilterFile( getDefaultFilterFilePath() );
}

FilterDialog.prototype = new Dialog;

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
   logDebug( "loadFilterFile aufgerufen mit: " + filePath );

   if ( !File.exists( filePath ) )
   {
      this.filters = [];
      this.filterFilePath = filePath;
      this.fileEdit.text = filePath;
      this.populateFilterCombo( [] );
      logWarn( "Filterdatei nicht gefunden: " + filePath );

      (new MessageBox(
         "Filterdatei nicht gefunden:\n" + filePath + "\n\n" +
         "Du kannst den FILTER-Wert weiterhin manuell eintragen.",
         "PIFilter",
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
      this.fileEdit.text = filePath;
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
         logDebug( "Filterliste geladen: " + loaded.length + " Eintraege" );
      }
      else
      {
         this.filterEdit.text = "";
         logWarn( "Filterdatei gelesen, aber ohne gueltige Eintraege." );
         (new MessageBox(
            "Datei geladen, aber keine gueltigen Filtereintraege gefunden.",
            "PIFilter",
            StdIcon_Warning,
            StdButton_Ok
         )).execute();
      }
   }
   catch ( ex )
   {
      logError( "Fehler beim Laden der Filterdatei: " + ex );
      (new MessageBox(
         "Fehler beim Laden der Filterdatei:\n" + ex,
         "PIFilter",
         StdIcon_Error,
         StdButton_Ok
      )).execute();
   }
};

function main()
{
   logDebug( "Skriptstart" );
   logDebug( "Gespeicherter letzter Batch-Ordner-Key: " + SETTINGS_KEY_LAST_BATCH_DIR );
   logDebug( "Gespeicherter letzter Filter-Key: " + SETTINGS_KEY_LAST_FILTER );

   var dlg = new FilterDialog;
   if ( !dlg.execute() )
   {
      logDebug( "Dialog abgebrochen." );
      return;
   }

   if ( dlg.runMode == "batch" )
   {
      var batchDir = trimText( dlg.batchDirectory );
      if ( batchDir.length == 0 )
      {
         logError( "Batch-Modus ohne Zielverzeichnis." );
         return;
      }

      var r = processBatchDirectory( batchDir, dlg.filterText );
      var summary =
         "Batch abgeschlossen.\n" +
         "Ordner: " + batchDir + "\n" +
         "Dateien gesamt: " + r.total + "\n" +
         "Erfolgreich: " + r.success + "\n" +
         "Fehler: " + r.failed;

      console.show();
      console.noteln( "[PIFilter] " + summary.replace( /\n/g, " | " ) );

      (new MessageBox(
         summary,
         "PIFilter",
         (r.failed > 0) ? StdIcon_Warning : StdIcon_Information,
         StdButton_Ok
      )).execute();

      return;
   }

   var w = ImageWindow.activeWindow;
   if ( w.isNull )
   {
      logError( "Kein aktives Bildfenster fuer Einzelmodus vorhanden." );
      (new MessageBox(
         "Kein aktives Bildfenster gefunden.\nBitte zuerst ein Bild oeffnen oder Batch verwenden.",
         "PIFilter",
         StdIcon_Error,
         StdButton_Ok
      )).execute();
      return;
   }

   var action = upsertFilterKeyword( w, dlg.filterText );

   console.show();
   console.noteln( "FILTER " + action + ": " + dlg.filterText );

   (new MessageBox(
      "FILTER wurde " + action + ": " + dlg.filterText,
      "PIFilter",
      StdIcon_Information,
      StdButton_Ok
   )).execute();
}

main();
