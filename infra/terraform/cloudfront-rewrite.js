function toHtmlPath(uri) {
  if (uri === "" || uri === "/") {
    return "/index.html";
  }

  if (uri.endsWith("/")) {
    return uri + "index.html";
  }

  if (uri.includes(".")) {
    return uri;
  }

  return uri + ".html";
}

function handler(event) {
  var request = event.request;
  request.uri = toHtmlPath(request.uri);
  return request;
}
