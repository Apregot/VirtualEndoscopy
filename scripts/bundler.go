package main

import (
    "bytes"
    "flag"
    "fmt"
    "os"
    "log"
    "bufio"
    "strings"
    "path/filepath"
)

/*
 * Простой bandler CSS файлов. Парсит данный ему HTML файл, вырезает все строки типа
 * <link rel="stylesheet" href="css/splitpane.css">, объединяет их в bunle.css с учетом возможных 
 * @import'ов внутри. Если через @import несколько раз добавляется один и тот же файл, то в bundle
 * он попадет только один раз. Понимает простые комментарии на одной строке <!-- .. -->
 * Блочные комментании не понимает (пока не надо)
 */

func main() {
    if len(os.Args) < 2 {
        fmt.Println("Usage:  bundler -f htmlfile [-outdir dir (default .)]")
        return
    }
    htmlfilePtr := flag.String("f","index.html","input HTML file")
    deploydirPtr := flag.String("outdir",".","output directory")
    flag.Parse()
    htmlfile,_ := filepath.Abs(*htmlfilePtr)
    deploydir,_ := filepath.Abs(*deploydirPtr)
    // fmt.Println("outdir", deploydir)
    // fmt.Println("htmlfile ", htmlfile)
    // return

    var buffer, cssbuf bytes.Buffer
    var sname []string
    cssBundleName := "bundle.css"
    htmlBundleName := "index.html"
    base,err := filepath.Abs(filepath.Dir(htmlfile))
    fmt.Println("base ",base)
    _, err = os.Stat(deploydir)
    if os.IsNotExist(err) {err := os.Mkdir(deploydir, 0755); if err != nil {log.Fatal(err)}}    
    cssBundlePath := deploydir+"/"+cssBundleName
    file, err := os.Open(htmlfile); if err != nil {log.Fatal(err)}
    defer file.Close()

    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        s := scanner.Text()
        if strings.Contains(s,"<!--") {continue}                    
        if strings.Contains(s,"<link") {
            s1 := strings.Split(s,"href=")[1]
            path := filepath.Clean(base+"/"+strings.Split(s1,"\"")[1])
            sname = append(sname,path)
            cssbuf.WriteString(s+"\n")
        } else {
            buffer.WriteString(s+"\n")
            if(strings.Contains(s,"<title>")) {
                buffer.WriteString("  <link rel=\"stylesheet\" href=\"bundle.css\">\n")
            }
        }
    }
    // fmt.Println(cssbuf.String())
    // fmt.Println(sname)

    cssBundle, err := os.Create(cssBundlePath);  if err != nil {log.Fatal(err)}

    for i := 0; i<len(sname); i++ {
        path := sname[i]
        fmt.Println(path) 
        file, err := os.Open(path); if err != nil {log.Fatal(err)}
        cssBundle.WriteString("\n/* "+path+" */")
        scanner = bufio.NewScanner(file)
        for scanner.Scan() {
            s := scanner.Text()
            if strings.Contains(s,"@import") {
                s1 := strings.Fields(s)[1]
                s2 := strings.Split(s1,"\"")[1];
                s3 := filepath.Clean(filepath.Dir(path)+"/"+s2)
                sname = addIfUnique(sname,s3)
            } else {
                cssBundle.WriteString(s)
            }
        }
        // fmt.Println(path)
        file.Close()
    }
    cssBundle.Close();

    htmlIndexPath := filepath.Join(deploydir,htmlBundleName)
    htmlIndex, err := os.Create(htmlIndexPath);  if err != nil {log.Fatal(err)}
    htmlIndex.WriteString(buffer.String())
    htmlIndex.Close();
}

func addIfUnique(names []string, path string) []string {
    for _, name := range names {
        if name == path {return names}
    }
    return  append(names,path)
}