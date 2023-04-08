<?php

namespace VirtualEndoscopy;
final class Config
{
	private static array $localConfig;

	const LINUX = 'Lin';
	const WINDOWS = 'Win';

	const DEFAULT_SCRIPT_DIRECTORY = 'scripts';
	const SUPPORTED_SYSTEMS = [
		self::WINDOWS,
		self::LINUX,
	];

	public static function getLocalConfig(): array
	{
		if (empty(self::$localConfig))
		{
			self::$localConfig = include('.local_config.php');
		}

		return self::$localConfig;
	}
}