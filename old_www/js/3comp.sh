#!/bin/bash
GCL=../../node_modules/google-closure-library
npx --no-install google-closure-compiler \
 --entry_point ./main.js \
 --output_manifest manifest.MF \
 --generate_exports \
 --compilation_level ADVANCED_OPTIMIZATIONS \
 --generate_exports \
 --js "$GCL/closure/goog/**.js" \
 --js "$GSL/third_party/**.js" \
 --js "!$GSL/closure/goog/**test.js" \
 --js "!$GSL/closure/goog/**tester.js"\
 --js "!$GSL/closure/goog/**_perf.js" \
 --js "!$GSL/closure/goog/storage/mechanism/mechanismtestdefinition.js" \
 --js "!GSL/closure/goog/promise/testsuiteadapter.js" \
 --externs ami.ext.js \
 --externs three.ext.js \
 --externs externs.js \
 --js V5TrackballControl.js \
 --js amiviewer.js \
 --js appconf.js \
 --js main.js \
 --js gfk/ui/dialog.js \
 --js gfk/ui/tabbar.js \
 --js gfk/ui/slider.js \
 --js gfk/ui/splitpane.js \
 --js gfk/ui/splitpanex.js \
 --js gfk/ui/progressbar.js \
 --js ./uibuilder.js \
 --js ./dumpDICOMfile.js \
 --js ./marchingcubes.js \
 --js ./tables.js \
 --js ./ffrdriver.js \
 --js ./cube.js \
 --js ./axplane.js \
 --js ./huv.js \
 --js ./axplanecontrols.js \
 --js ./up3.js \
 --js ./SubdivisionModifier.js \
 --js ./filevolumeloader.js \
 --js ./fsf.js \
 --js ./ffrprotocol.js \
 --js ./H_loadDICOM.js \
 --js ./ui/components/FakeLeftPanelComponent.js \
 --js ./ui/components/VesselListComponent.js \
 --js ./ui/components/LeftPanelComponent.js \
 --js ./ui/components/MarkStenosisComponent.js \
 --js ./ui/components/quadview.js \
 --js ./ui/components/SeriesListsComponent.js \
 --js ./ui/dialogs/Dialog8.js \
 --js ./ui/dialogs/Dialog10.js \
 --js ./ui/dialogs/Dialog11.js \
 --js ./onion.js \
 --js ./ui/components/VesselHistogramComponent.js \
 --js ./Lut.js \
 --js ./rainbow.js \
 --js ./plasticboy.js \
 --js ./rgt.js \
 --create_source_map ffr-min.js.map \
 --js_output_file ffr-min.js
echo "//# sourceMappingURL=ffr-min.js.map" >>ffr-min.js
#  --entry_point ./main.js \
#  --js '!../../closure-library/closure/goog/bootstrap/bytestring_perf.js' \
#  --js '!../../closure-library/closure/bin/generate_closure_unit_tests/generate_closure_unit_tests.js' \
#  --js '!.././closure-library/closure/goog/bootstrap/nodes.js' \
#  --dependency_mode=SORT_ONLY \
# java -jar /ArterialTreeBuilder/node_modules/google-closure-compiler-java/compiler.jar \

