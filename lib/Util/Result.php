<?php

namespace VirtualEndoscopy\Util;

final class Result
{
	private array $data = [];
	private bool $isSuccessful = true;

	public function isSuccessful(): bool
	{
		return $this->isSuccessful;
	}

	public function getData(): array
	{
		return $this->data;
	}

	public function setData(array $data): self
	{
		$this->data = $data;

		return $this;
	}
}