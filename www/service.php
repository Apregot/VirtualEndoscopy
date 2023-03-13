<?php 	// service.php?c={start|stop} 
	$atb_binary = "bin/atb";
	$cwd = getcwd();
	$atb_path = $cwd."/".$atb_binary;

    $cmd = $_REQUEST['c'];
    if($cmd == "") {echo "no cmd"; return;}
    else if($cmd == "start") {
    	exec_on_background($atb_path,$cwd."/bin");
    	echo  "started ".$atb_path;
    }
    else if($cmd == "stop") {
		exec('whoami', $output, $retval);
		echo "Вернёт статус $retval и значение:\n";
		print_r($output);
    }

	// выводит имя пользователя, от имени которого запущен процесс php/httpd
	// (применимо к системам с командой "whoami" в системном пути)
	// $output=null;
	// $retval=null;
	// exec('/home/guerman/hello', $output, $retval);
	// echo "Вернёт статус $retval и значение:\n";
	// print_r($output);


// yy-mm-dd hh:mm:ss.xxx msg
function xlog($msg) {
    $log_file="service-log.txt";
    $date = date('y-m-d H:i:s');
    list($usec, $sec) = explode(" ", microtime());
    $usec = sprintf("%03d",round($usec*1000));
    $line=$date.".".$usec." ".$msg."\r\n";
    file_put_contents($log_file,$line,FILE_APPEND);
}

// запустить процесс в фоновом режиме, с установкой cwd
function exec_on_background($cmd, $workdir) {
    $logmsg="exec_on_background(".$cmd.",".$workdir.")"; xlog($logmsg);
    chdir($workdir);
    $cmd_linux = $cmd." >>atb-stdout.txt 2>&1 &";
    exec($cmd_linux, $output, $return_var);
}

?>