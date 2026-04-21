locals {
  common_tags = merge(var.tags, {
    Repository = "infrastructure-as-words"
  })
}
