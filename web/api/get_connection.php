<?php
require_once 'include.php';

$a = new \VirtualEndoscopy\Connection\ConnectionManager();
$a->getConnection();
//echo '<pre>';
//$content = system('cmd /c docker images 2&>1', $ret);
//var_dump($content);
//echo '</pre>';

//$app = \VirtualEndoscopy\App::getInstance();
//$b = new \VirtualEndoscopy\Build\BuildManager();
//$b->isBaseLayersBuilt();
//echo $app->getContext()->execute(\VirtualEndoscopy\Config::SCRIPTS['findFreePort']);
