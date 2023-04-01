<?php
require_once 'include.php';

$connectionManager = new \VirtualEndoscopy\Connection\ConnectionManager();
$result = $connectionManager->getConnection();
