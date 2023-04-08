<?php
require_once 'include.php';
$result = (new \VirtualEndoscopy\Connection\ConnectionManager())->getConnection();
var_dump($result->getData()['freePort']);
