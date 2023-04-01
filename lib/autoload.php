<?php
spl_autoload_register(function ($className) {
	$fileParts = $classParts = explode("\\", $className);
	array_shift($fileParts);

	$projectPath = realpath($_SERVER['DOCUMENT_ROOT']) . DIRECTORY_SEPARATOR . '..';
	$libPath = $projectPath . DIRECTORY_SEPARATOR . 'lib';
	$file = $libPath . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $fileParts) . '.php';

	if (file_exists($file))
	{
		require_once $file;
		return true;
	}

	return false;
});