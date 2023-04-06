<?php

namespace VirtualEndoscopy\Connection;

class ConnectionManager
{
	public function getConnection()
	{
		//if no connection
		$freePort = $this->getFreePort();
		if ($freePort > 0)
		{
			//start container with port
		}

		return true;
	}
	private function getFreePort(): int
	{
		$findFreePortScript = 'is_built.bat';
		$currentDirectory = system('echo %cd%');
		echo '<br>';
		$scriptDirectory = $currentDirectory . '/../../scripts/windows/';
		$command = 'cmd /c '. $scriptDirectory . $findFreePortScript .' 2>&1';

		var_dump(system($command, $resultCode));
		return $resultCode;
	}
}