# 初见雷达

照片第一印象趣味测评：初见类型、六维雷达、有依据的亮点、场景建议和PNG分享卡。

网站：[初见雷达](https://ehendley.github.io/firstlook-radar/)

本站使用 GitHub Pages 的 main 分支根目录发布。根目录是可直接运行的前端部署文件。完整源码（含结果设计、Cloudflare后端、测试、部署说明）见 [full-source.zip](full-source.zip)。解压后按其中 README.md 操作。

后端：https://firstlook-radar-api.ehendley62.workers.dev 。已接通阿里云百炼 qwen3-vl-plus（北京），API Key仅保存在Cloudflare Worker Secret中。

验证：21项自动测试通过；已用阿里云官方示例图成功生成真实报告（约33秒），返回6个维度、3个记忆点和3条建议。桌面/320px手机布局、照片上传压缩及PNG下载已检查。示例报告与真实分析明确区分，测试不代表对所有照片的效果或准确性保证。
