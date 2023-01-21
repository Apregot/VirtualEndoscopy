java -jar ..\..\closure-library\closure-compiler-v20190301.jar^
 --generate_exports^
 --entry_point ./geratabs.js^
 --compilation_level ADVANCED_OPTIMIZATIONS^
 --generate_exports^
 --js '..\..\closure-library/closure/**.js'^
 --js '..\..\closure-library//third_party/**.js^
 --js '!..\..\closure-library/**test.js'^
 --js '!..\..\closure-library/**tester.js'^
 --js '!..\..\closure-library/**_perf.js'^
 --js '!..\..\closure-library/closure/goog/bootstrap/nodes.js'^
 --js '!..\..\closure-library/closure/goog/bootstrap/bytestring_perf.js'^
 --js '!..\..\closure-library/closure/bin/generate_closure_unit_tests/generate_closure_unit_tests.js'^
 --js geratabs.js^
 --js gfk/ui/tabbar.js^
 --js_output_file geratabs-min.js
REM echo //# sourceMappingURL=v5-min.js.map >>v5-min.js


