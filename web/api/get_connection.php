<?php
require_once 'include.php';

$app = \VirtualEndoscopy\App::getInstance();
echo $app->getContext()->execute(\VirtualEndoscopy\Config::SCRIPTS['findFreePort']);
