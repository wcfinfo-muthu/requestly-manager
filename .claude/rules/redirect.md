
# Redirect Rule

## Example
{
  type: "redirect",
  condition: { url: "example.com/api" },
  action: { redirectUrl: "mock.com/api" }
}

## Logic
if (url.includes(condition.url)) {
  redirect
}
