<?php
namespace VirtualEndoscopy;

use Exception;
use VirtualEndoscopy\Context;

final class App
{
	private static ?App $instance = null;
	private Context\Context $context;

	public static function getInstance(): self
	{
		if (!self::$instance)
		{
			self::$instance= new self();
		}

		return self::$instance;
	}

	private function __construct()
	{
		$this->initContext();
		echo $this->context->getType();
	}

	private function initContext(): void
	{
		$systemCode = $this->getSystemCode();
		if (!in_array($systemCode, Config::SUPPORTED_SYSTEMS))
		{
			throw new Exception('Your System is not supported', 10010);
		}

		$this->context = match ($systemCode) {
			Config::WINDOWS => new Context\Windows(),
			Config::LINUX => new Context\Linux(),
			default => throw new Exception('Context is not initialized', 10020),
		};
	}

	/**
	 * @throws Exception
	 */
	private function getSystemCode(): string
	{
		return substr(php_uname('s'), 0 , 3);
	}
}
